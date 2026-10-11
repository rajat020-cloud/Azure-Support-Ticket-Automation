import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { TicketModel, ITicket } from '../src/models/Ticket';
import { UserModel, IUser } from '../src/models/User';
import * as databaseConfig from '../src/config/database';

/**
 * Stateful Mongoose Model Test Double for deterministic, credential-free API testing.
 * Enforces unique index constraints on `ticketId` and `email` (throwing E11000 on duplicates),
 * supports filtering, regex search, deterministic sorting, pagination, and atomic updates.
 */
const inMemoryStore = new Map<string, ITicket & { _id: string }>();
const inMemoryUsers = new Map<string, IUser & { _id: string }>();
let simulatedDbConnected = true;

vi.spyOn(databaseConfig, 'isDatabaseConnected').mockImplementation(() => simulatedDbConnected);
vi.spyOn(databaseConfig, 'getDatabaseStatus').mockImplementation(() =>
  simulatedDbConnected ? 'connected' : 'disconnected'
);

function matchesFilter(doc: ITicket, filter: Record<string, unknown>): boolean {
  for (const [key, val] of Object.entries(filter)) {
    if (key === '$or' && Array.isArray(val)) {
      const orMatched = val.some((clause: Record<string, RegExp>) =>
        Object.entries(clause).some(([field, regex]) => {
          const fieldVal = String((doc as unknown as Record<string, unknown>)[field] || '');
          return regex.test(fieldVal);
        })
      );
      if (!orMatched) return false;
    } else if ((doc as unknown as Record<string, unknown>)[key] !== val) {
      return false;
    }
  }
  return true;
}

vi.spyOn(UserModel, 'create').mockImplementation((async (doc: Partial<IUser>) => {
  const email = String(doc.email || '').toLowerCase();
  if (inMemoryUsers.has(email)) {
    const dupErr = new Error(
      `E11000 duplicate key error collection: users index: email_1 dup key: { email: "${email}" }`
    ) as Error & { code: number; keyValue: Record<string, unknown> };
    dupErr.code = 11000;
    dupErr.keyValue = { email };
    throw dupErr;
  }
  const now = new Date();
  const saved: IUser & { _id: string } = {
    _id: `mock_user_${email}`,
    name: String(doc.name || ''),
    email,
    passwordHash: String(doc.passwordHash || ''),
    passwordSalt: String(doc.passwordSalt || ''),
    role: doc.role || 'reviewer',
    createdAt: now,
    updatedAt: now,
  };
  inMemoryUsers.set(email, saved);
  return {
    ...saved,
    toObject: () => ({ ...saved }),
  } as unknown as ReturnType<typeof UserModel.create>;
}) as unknown as typeof UserModel.create);

vi.spyOn(UserModel, 'findOne').mockImplementation(((filter: { email?: string }) => {
  const email = filter.email ? filter.email.toLowerCase() : '';
  const found = email ? inMemoryUsers.get(email) || null : null;
  return {
    lean: async () => (found ? { ...found } : null),
  } as unknown as ReturnType<typeof UserModel.findOne>;
}) as unknown as typeof UserModel.findOne);

vi.spyOn(TicketModel, 'create').mockImplementation((async (doc: Partial<ITicket>) => {
  const id = String(doc.ticketId || '');
  if (inMemoryStore.has(id)) {
    const dupErr = new Error(
      `E11000 duplicate key error collection: tickets index: ticketId_1 dup key: { ticketId: "${id}" }`
    ) as Error & { code: number };
    dupErr.code = 11000;
    throw dupErr;
  }

  const now = new Date();
  const saved: ITicket & { _id: string } = {
    _id: `mock_id_${id}`,
    ticketId: id,
    message: String(doc.message || ''),
    category: doc.category || 'General',
    priority: doc.priority || 'Low',
    assignedTeam: doc.assignedTeam || 'General Support',
    summary: String(doc.summary || ''),
    draftResponse: String(doc.draftResponse || ''),
    confidence: Number(doc.confidence ?? 0.5),
    classificationExplanation: String(doc.classificationExplanation || ''),
    matchedSignals: doc.matchedSignals || [],
    prioritySignals: doc.prioritySignals || [],
    categoryScores: doc.categoryScores || {
      Billing: 0,
      Technical: 0,
      Access: 0,
      General: 0,
    },
    slaTarget: doc.slaTarget || {
      firstResponseMinutes: 1440,
      resolutionHours: 72,
      label: '24h response / 72h resolution SLA',
    },
    isUncertain: Boolean(doc.isUncertain),
    reviewStatus: doc.reviewStatus || 'pending_review',
    approvalMetadata: doc.approvalMetadata || {
      approvedBy: null,
      approvedAt: null,
      reviewerNotes: null,
    },
    auditLog: doc.auditLog || [],
    createdAt: now,
    updatedAt: now,
  };

  inMemoryStore.set(id, saved);
  return {
    ...saved,
    toObject: () => ({ ...saved }),
  } as unknown as ReturnType<typeof TicketModel.create>;
}) as unknown as typeof TicketModel.create);

vi.spyOn(TicketModel, 'findOne').mockImplementation(((filter: { ticketId?: string }) => {
  const found = filter.ticketId ? inMemoryStore.get(filter.ticketId) || null : null;
  const docResult = found
    ? {
        ...found,
        toObject: () => ({ ...found }),
      }
    : null;
  return {
    lean: async () => (found ? { ...found } : null),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(docResult).then(resolve),
  } as unknown as ReturnType<typeof TicketModel.findOne>;
}) as unknown as typeof TicketModel.findOne);

vi.spyOn(TicketModel, 'findOneAndUpdate').mockImplementation(((
  filter: Record<string, unknown>,
  update: { $set?: Partial<ITicket> }
) => {
  const id = String(filter.ticketId || '');
  const existing = inMemoryStore.get(id);
  if (!existing || !matchesFilter(existing, filter)) {
    return {
      lean: async () => null,
    } as unknown as ReturnType<typeof TicketModel.findOneAndUpdate>;
  }
  const updated: ITicket & { _id: string } = {
    ...existing,
    ...(update.$set || {}),
    updatedAt: new Date(),
  };
  inMemoryStore.set(id, updated);
  return {
    lean: async () => ({ ...updated }),
  } as unknown as ReturnType<typeof TicketModel.findOneAndUpdate>;
}) as unknown as typeof TicketModel.findOneAndUpdate);

vi.spyOn(TicketModel, 'countDocuments').mockImplementation((async (
  filter: Record<string, unknown> = {}
) => {
  let count = 0;
  for (const doc of inMemoryStore.values()) {
    if (matchesFilter(doc, filter)) count += 1;
  }
  return count;
}) as unknown as typeof TicketModel.countDocuments);

vi.spyOn(TicketModel, 'find').mockImplementation(((filter: Record<string, unknown> = {}) => {
  let results = Array.from(inMemoryStore.values()).filter((doc) => matchesFilter(doc, filter));
  return {
    sort(sortSpec: Record<string, 1 | -1>) {
      const entries = Object.entries(sortSpec);
      results = [...results].sort((a, b) => {
        for (const [field, dir] of entries) {
          const av = (a as unknown as Record<string, number | string>)[field];
          const bv = (b as unknown as Record<string, number | string>)[field];
          if (av < bv) return -1 * dir;
          if (av > bv) return 1 * dir;
        }
        return 0;
      });
      return this;
    },
    skip(n: number) {
      results = results.slice(n);
      return this;
    },
    limit(n: number) {
      results = results.slice(0, n);
      return this;
    },
    lean: async () => results.map((r) => ({ ...r })),
  } as unknown as ReturnType<typeof TicketModel.find>;
}) as unknown as typeof TicketModel.find);

vi.spyOn(TicketModel, 'aggregate').mockImplementation((async (
  pipeline: Array<{ $group?: { _id: string } }>
) => {
  const groupField = pipeline[0]?.$group?._id?.replace(/^\$/, '') || '';
  const counts = new Map<string, number>();
  for (const doc of inMemoryStore.values()) {
    const key = String((doc as unknown as Record<string, unknown>)[groupField] || '');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([_id, count]) => ({ _id, count }));
}) as unknown as typeof TicketModel.aggregate);

describe('API Endpoint Tests (Supertest + Express + Stateful Repository Double)', () => {
  const TEST_REVIEWER_SECRET = 'test-reviewer-secret-key-ps04';
  process.env.NODE_ENV = 'test';
  process.env.REVIEWER_API_KEY = TEST_REVIEWER_SECRET;

  const app = createApp();

  beforeEach(() => {
    inMemoryStore.clear();
    inMemoryUsers.clear();
    simulatedDbConnected = true;
  });

  it('Scenario 1, 2, 3, 4: Successful ticket creation with correct category, priority, team, summary, and draft response', async () => {
    const res = await request(app).post('/api/tickets').send({
      ticketId: 'TCK-1001',
      message: 'I cannot access my account after resetting my password.',
    });

    expect(res.status).toBe(201);
    expect(res.body.ticket).toBeDefined();
    expect(res.body.ticket.ticketId).toBe('TCK-1001');
    expect(res.body.ticket.category).toBe('Access');
    expect(res.body.ticket.priority).toBe('High');
    expect(res.body.ticket.assignedTeam).toBe('Identity and Access Support');
    expect(res.body.ticket.reviewStatus).toBe('pending_review');
    expect(res.body.ticket.summary).toContain('Access');
    expect(res.body.ticket.draftResponse).toContain('TCK-1001');
  });

  it('Scenario 5: Rejects missing ticket ID with HTTP 400', async () => {
    const res = await request(app).post('/api/tickets').send({
      message: 'We were charged twice on our monthly invoice.',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
  });

  it('Scenario 6: Rejects empty customer message with HTTP 400', async () => {
    const res = await request(app).post('/api/tickets').send({
      ticketId: 'TCK-1002',
      message: '   ',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
  });

  it('Scenario 7: Rejects malformed JSON request payload with HTTP 400', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Content-Type', 'application/json')
      .send('{"ticketId": "TCK-1003", "message": "broken json');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
  });

  it('Scenario 8: Rejects duplicate ticket ID with HTTP 409 Conflict', async () => {
    const payload = {
      ticketId: 'TCK-DUP-1',
      message: 'Our monthly invoice shows a duplicate charge of $500.',
    };

    const first = await request(app).post('/api/tickets').send(payload);
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/tickets').send(payload);
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('ConflictError');
  });

  it('Scenario 9 & 12: Routes ambiguous ticket to manual review (needs_review) and prevents direct draft approval', async () => {
    const createRes = await request(app).post('/api/tickets').send({
      ticketId: 'TCK-AMB-1',
      message: 'Need help urgently with our portal, something is wrong and we cannot proceed.',
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.ticket.isUncertain).toBe(true);
    expect(createRes.body.ticket.reviewStatus).toBe('needs_review');

    // Attempt to approve an uncertain ticket must be blocked with HTTP 422
    const approveRes = await request(app)
      .post('/api/tickets/TCK-AMB-1/approve')
      .set('x-reviewer-api-key', TEST_REVIEWER_SECRET)
      .send({ approved: true, reviewerId: 'qa-reviewer@example.com' });

    expect(approveRes.status).toBe(422);
    expect(approveRes.body.error).toBe('ManualReviewRequired');
  });

  it('Scenario 10, 11, 17: Enforces reviewer authorization on approval, approves eligible ticket, and rejects repeated approval', async () => {
    await request(app).post('/api/tickets').send({
      ticketId: 'TCK-BILL-1',
      message: 'We were charged twice on our monthly subscription invoice INV-900.',
    });

    // Scenario 11a: Missing key -> 401
    const noKeyRes = await request(app)
      .post('/api/tickets/TCK-BILL-1/approve')
      .send({ approved: true });
    expect(noKeyRes.status).toBe(401);

    // Scenario 11b: Wrong key -> 403
    const wrongKeyRes = await request(app)
      .post('/api/tickets/TCK-BILL-1/approve')
      .set('x-reviewer-api-key', 'wrong-secret-key')
      .send({ approved: true });
    expect(wrongKeyRes.status).toBe(403);

    // Scenario 10: Valid key and explicit confirmation -> 200
    const validApproveRes = await request(app)
      .post('/api/tickets/TCK-BILL-1/approve')
      .set('x-reviewer-api-key', TEST_REVIEWER_SECRET)
      .send({
        approved: true,
        reviewerId: 'reviewer-lead@example.com',
        reviewerNotes: 'Verified invoice record.',
      });

    expect(validApproveRes.status).toBe(200);
    expect(validApproveRes.body.ticket.reviewStatus).toBe('approved');
    expect(validApproveRes.body.ticket.approvalMetadata.approvedBy).toBe(
      'reviewer-lead@example.com'
    );
    expect(validApproveRes.body.ticket.approvalMetadata.approvedAt).toBeTruthy();

    // Scenario 17: Repeated approval on already-approved ticket -> 409 Conflict
    const repeatApproveRes = await request(app)
      .post('/api/tickets/TCK-BILL-1/approve')
      .set('x-reviewer-api-key', TEST_REVIEWER_SECRET)
      .send({ approved: true, reviewerId: 'reviewer-lead@example.com' });

    expect(repeatApproveRes.status).toBe(409);
    expect(repeatApproveRes.body.error).toBe('ConflictError');
  });

  it('Scenario 13: Returns HTTP 404 when retrieving a nonexistent ticket', async () => {
    const res = await request(app).get('/api/tickets/TCK-DOES-NOT-EXIST');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NotFound');
  });

  it('Scenario 14: Supports pagination, search, category/priority filtering, and dashboard metrics', async () => {
    await request(app).post('/api/tickets').send({
      ticketId: 'TCK-201',
      message: 'We were charged twice on our monthly billing invoice.',
    });
    await request(app).post('/api/tickets').send({
      ticketId: 'TCK-202',
      message: 'API gateway is crashing with 502 bad gateway errors.',
    });
    await request(app).post('/api/tickets').send({
      ticketId: 'TCK-203',
      message: 'Could you share user guides and product roadmap documentation?',
    });

    const listBilling = await request(app).get('/api/tickets?category=Billing&page=1&limit=2');
    expect(listBilling.status).toBe(200);
    expect(listBilling.body.tickets).toHaveLength(1);
    expect(listBilling.body.tickets[0].ticketId).toBe('TCK-201');
    expect(listBilling.body.pagination.total).toBe(1);

    const searchRes = await request(app).get('/api/tickets?search=gateway');
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.tickets).toHaveLength(1);
    expect(searchRes.body.tickets[0].ticketId).toBe('TCK-202');

    const metricsRes = await request(app).get('/api/metrics');
    expect(metricsRes.status).toBe(200);
    expect(metricsRes.body.totalTickets).toBe(3);
    expect(metricsRes.body.byCategory.Billing).toBe(1);
    expect(metricsRes.body.byCategory.Technical).toBe(1);
    expect(metricsRes.body.byCategory.General).toBe(1);
  });

  it('Scenario 15: Handles database-unavailable state gracefully with HTTP 503', async () => {
    simulatedDbConnected = false;

    const healthRes = await request(app).get('/api/health');
    expect(healthRes.status).toBe(503);
    expect(healthRes.body.database.connected).toBe(false);

    const createRes = await request(app).post('/api/tickets').send({
      ticketId: 'TCK-503',
      message: 'I cannot log into my account after resetting my password.',
    });
    expect(createRes.status).toBe(503);
    expect(createRes.body.error).toBe('DatabaseUnavailable');
  });

  it('Scenario 16: Returns held-out evaluation metrics via GET /api/evaluation', async () => {
    const evalRes = await request(app).get('/api/evaluation');
    expect(evalRes.status).toBe(200);
    expect(evalRes.body.evaluation.totalTestTickets).toBe(12);
    expect(evalRes.body.evaluation.overallCategoryAccuracy).toBeGreaterThanOrEqual(0.75);
  });

  it('Scenario 18: Supports Reviewer Sign-Up, Sign-In, Manual Triage resolution, and JWT-authenticated approval', async () => {
    // 1. Register a new Reviewer account
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Rajat Reviewer',
      email: 'rajat@example.com',
      password: 'securePassword123',
    });
    expect(regRes.status).toBe(201);
    expect(regRes.body.token).toBeTruthy();
    expect(regRes.body.user.email).toBe('rajat@example.com');

    // 2. Duplicate registration returns 409 Conflict
    const dupReg = await request(app).post('/api/auth/register').send({
      name: 'Rajat Reviewer',
      email: 'rajat@example.com',
      password: 'securePassword123',
    });
    expect(dupReg.status).toBe(409);

    // 3. Sign in with registered account
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'rajat@example.com',
      password: 'securePassword123',
    });
    expect(loginRes.status).toBe(200);
    const jwtToken = loginRes.body.token;

    // 4. Create an ambiguous ticket routed to needs_review
    const ambRes = await request(app).post('/api/tickets').send({
      ticketId: 'TCK-TRIAGE-1',
      message: 'Need help urgently with our portal, something is wrong and we cannot proceed.',
    });
    expect(ambRes.body.ticket.reviewStatus).toBe('needs_review');

    // 5. Perform Manual Specialist Triage using the Reviewer JWT token
    const triageRes = await request(app)
      .patch('/api/tickets/TCK-TRIAGE-1/triage')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        category: 'Technical',
        priority: 'High',
        summary: '[Technical | High] Confirmed portal crash after customer follow-up.',
        draftResponse: 'Hello, we have confirmed the technical portal error and are investigating.',
        resolveUncertainty: true,
      });
    expect(triageRes.status).toBe(200);
    expect(triageRes.body.ticket.category).toBe('Technical');
    expect(triageRes.body.ticket.assignedTeam).toBe('Technical Support');
    expect(triageRes.body.ticket.isUncertain).toBe(false);
    expect(triageRes.body.ticket.reviewStatus).toBe('pending_review');

    // 6. Approve the triaged ticket using the Reviewer JWT token
    const approveRes = await request(app)
      .post('/api/tickets/TCK-TRIAGE-1/approve')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ approved: true });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.ticket.reviewStatus).toBe('approved');
    expect(approveRes.body.ticket.approvalMetadata.approvedBy).toBe('rajat@example.com');
    expect(approveRes.body.ticket.auditLog).toHaveLength(3);
  });

  it('Scenario 19: Performs stateless live AI preview via POST /api/analyze without persisting to DB', async () => {
    const analyzeRes = await request(app).post('/api/analyze').send({
      ticketId: 'TCK-PREVIEW-99',
      message:
        'URGENT: Production API gateway is returning 502 Bad Gateway errors for all 600 enterprise customers.',
    });

    expect(analyzeRes.status).toBe(200);
    expect(analyzeRes.body.analysis.category).toBe('Technical');
    expect(analyzeRes.body.analysis.priority).toBe('Critical');
    expect(analyzeRes.body.analysis.slaTarget.firstResponseMinutes).toBe(15);
    expect(analyzeRes.body.analysis.categoryScores.Technical).toBeGreaterThan(0);

    // Ensure stateless preview did not persist a ticket in the database
    const fetchRes = await request(app).get('/api/tickets/TCK-PREVIEW-99');
    expect(fetchRes.status).toBe(404);
  });
});

