import { Request, Response, NextFunction } from 'express';
import { FilterQuery } from 'mongoose';
import {
  ITicketDocument,
  REVIEW_STATUSES,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TicketModel,
} from '../models/Ticket';
import { isDatabaseConnected } from '../config/database';
import { getConfig } from '../config/env';
import {
  analyzeTicketSchema,
  approveTicketSchema,
  createTicketSchema,
  listTicketsQuerySchema,
  triageTicketSchema,
} from '../middleware/validateMiddleware';
import {
  AuthenticatedRequest,
  extractReviewerKey,
  safeCompareSecrets,
} from '../middleware/authMiddleware';
import { classifyTicketMessage } from '../services/classifierService';
import { determineTicketPriority, PRIORITY_SLA_MAP } from '../services/priorityService';
import { routeTicket } from '../services/routingService';
import { generateSummaryAndDraft } from '../services/draftService';
import { evaluateHeldOutDataset } from '../services/evaluationService';
import { verifyAuthToken } from '../models/User';

function ensureDbConnected(res: Response): boolean {
  if (!isDatabaseConnected()) {
    res.status(503).json({
      error: 'DatabaseUnavailable',
      message: 'Database connection is not active. Unable to process ticket operation.',
    });
    return false;
  }
  return true;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function analyzeTicketPreview(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const validated = analyzeTicketSchema.parse(req.body);

    const classification = classifyTicketMessage(validated.message);
    const priorityResult = determineTicketPriority(
      validated.message,
      classification.category
    );
    const routing = routeTicket(
      classification.category,
      priorityResult.priority,
      classification.isUncertain
    );
    const { summary, draftResponse } = generateSummaryAndDraft({
      ticketId: validated.ticketId || 'PREVIEW-001',
      message: validated.message,
      category: classification.category,
      priority: priorityResult.priority,
      assignedTeam: routing.assignedTeam,
      isUncertain: classification.isUncertain,
      matchedSignals: classification.matchedSignals,
    });

    res.status(200).json({
      analysis: {
        category: classification.category,
        priority: priorityResult.priority,
        assignedTeam: routing.assignedTeam,
        reviewStatus: routing.reviewStatus,
        confidence: classification.confidence,
        confidenceThreshold: getConfig().confidenceThreshold,
        isUncertain: classification.isUncertain,
        uncertaintyReason: classification.uncertaintyReason,
        classificationExplanation: `${classification.explanation} ${priorityResult.priorityExplanation}`,
        matchedSignals: classification.matchedSignals,
        prioritySignals: priorityResult.prioritySignals,
        categoryScores: classification.categoryScores,
        slaTarget: priorityResult.slaTarget,
        summary,
        draftResponse,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createTicket(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validated = createTicketSchema.parse(req.body);

    if (!ensureDbConnected(res)) return;

    const classification = classifyTicketMessage(validated.message);
    const priorityResult = determineTicketPriority(
      validated.message,
      classification.category
    );
    const routing = routeTicket(
      classification.category,
      priorityResult.priority,
      classification.isUncertain
    );
    const { summary, draftResponse } = generateSummaryAndDraft({
      ticketId: validated.ticketId,
      message: validated.message,
      category: classification.category,
      priority: priorityResult.priority,
      assignedTeam: routing.assignedTeam,
      isUncertain: classification.isUncertain,
      matchedSignals: classification.matchedSignals,
    });

    const createdTicket = await TicketModel.create({
      ticketId: validated.ticketId,
      message: validated.message,
      category: classification.category,
      priority: priorityResult.priority,
      assignedTeam: routing.assignedTeam,
      summary,
      draftResponse,
      confidence: classification.confidence,
      classificationExplanation: `${classification.explanation} ${priorityResult.priorityExplanation}`,
      matchedSignals: classification.matchedSignals,
      prioritySignals: priorityResult.prioritySignals,
      categoryScores: classification.categoryScores,
      slaTarget: priorityResult.slaTarget,
      isUncertain: classification.isUncertain,
      reviewStatus: routing.reviewStatus,
      approvalMetadata: {
        approvedBy: null,
        approvedAt: null,
        reviewerNotes: null,
      },
      auditLog: [
        {
          action: 'created',
          actor: 'ai-triage-engine',
          timestamp: new Date(),
          details: `Ticket classified as ${classification.category} (${priorityResult.priority} priority, confidence ${classification.confidence.toFixed(
            2
          )}) and routed to ${routing.assignedTeam} with status ${routing.reviewStatus}.`,
        },
      ],
    });

    res.status(201).json({
      ticket: createdTicket.toObject(),
    });
  } catch (err) {
    next(err);
  }
}

export async function listTickets(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = listTicketsQuerySchema.parse(req.query);

    if (!ensureDbConnected(res)) return;

    const filter: FilterQuery<ITicketDocument> = {};

    if (query.category) {
      filter.category = query.category;
    }
    if (query.priority) {
      filter.priority = query.priority;
    }
    if (query.reviewStatus) {
      filter.reviewStatus = query.reviewStatus;
    }
    if (query.search && query.search.length > 0) {
      const safePattern = new RegExp(escapeRegExp(query.search), 'i');
      filter.$or = [
        { ticketId: safePattern },
        { message: safePattern },
        { summary: safePattern },
        { assignedTeam: safePattern },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;

    const [tickets, total] = await Promise.all([
      TicketModel.find(filter)
        .sort({ [query.sortBy]: sortDir, ticketId: 1 })
        .skip(skip)
        .limit(query.limit)
        .lean(),
      TicketModel.countDocuments(filter),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / query.limit));

    res.status(200).json({
      tickets,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPrevPage: query.page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getTicketById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!ensureDbConnected(res)) return;

    const ticketId = (req.params.ticketId || '').trim();
    if (!ticketId) {
      res.status(400).json({
        error: 'ValidationError',
        message: 'ticketId parameter is required.',
      });
      return;
    }

    const ticket = await TicketModel.findOne({ ticketId }).lean();
    if (!ticket) {
      res.status(404).json({
        error: 'NotFound',
        message: `Ticket with ID '${ticketId}' was not found.`,
      });
      return;
    }

    res.status(200).json({ ticket });
  } catch (err) {
    next(err);
  }
}

export async function triageTicket(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validatedBody = triageTicketSchema.parse(req.body);

    if (!ensureDbConnected(res)) return;

    const ticketId = (req.params.ticketId || '').trim();
    const existingTicket = await TicketModel.findOne({ ticketId });

    if (!existingTicket) {
      res.status(404).json({
        error: 'NotFound',
        message: `Ticket with ID '${ticketId}' was not found.`,
      });
      return;
    }

    if (existingTicket.reviewStatus === 'approved') {
      res.status(409).json({
        error: 'ConflictError',
        message: `Ticket '${ticketId}' is already approved and cannot be modified.`,
      });
      return;
    }

    const updatedCategory = validatedBody.category || existingTicket.category;
    const updatedPriority = validatedBody.priority || existingTicket.priority;
    const resolveUncertainty = validatedBody.resolveUncertainty !== false;
    const updatedIsUncertain = resolveUncertainty ? false : existingTicket.isUncertain;

    const routing = routeTicket(updatedCategory, updatedPriority, updatedIsUncertain);
    const updatedSla = PRIORITY_SLA_MAP[updatedPriority];

    const reviewerIdentity =
      req.reviewerUser?.email || 'human-triage-specialist';

    const updatedExplanation = resolveUncertainty && existingTicket.isUncertain
      ? `${existingTicket.classificationExplanation} [Manual Triage Completed by ${reviewerIdentity}: Confirmed Category=${updatedCategory}, Priority=${updatedPriority}]`
      : existingTicket.classificationExplanation;

    const currentAuditLog = Array.isArray(existingTicket.auditLog)
      ? [...existingTicket.auditLog]
      : [];

    currentAuditLog.push({
      action: 'triaged',
      actor: reviewerIdentity,
      timestamp: new Date(),
      details: `Manual triage applied: Category=${updatedCategory}, Priority=${updatedPriority}, Team=${routing.assignedTeam}, Status=${routing.reviewStatus}.`,
    });

    const updatedTicket = await TicketModel.findOneAndUpdate(
      { ticketId },
      {
        $set: {
          category: updatedCategory,
          priority: updatedPriority,
          assignedTeam: routing.assignedTeam,
          slaTarget: updatedSla,
          summary: validatedBody.summary || existingTicket.summary,
          draftResponse: validatedBody.draftResponse || existingTicket.draftResponse,
          isUncertain: updatedIsUncertain,
          reviewStatus: routing.reviewStatus,
          classificationExplanation: updatedExplanation,
          auditLog: currentAuditLog,
        },
      },
      { new: true }
    ).lean();

    res.status(200).json({
      message: `Manual specialist triage saved for ticket '${ticketId}'. Ticket is now ready for final approval.`,
      ticket: updatedTicket,
    });
  } catch (err) {
    next(err);
  }
}

export async function approveTicketDraft(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validatedBody = approveTicketSchema.parse(req.body);

    if (!ensureDbConnected(res)) return;

    const ticketId = (req.params.ticketId || '').trim();
    const existingTicket = await TicketModel.findOne({ ticketId });

    if (!existingTicket) {
      res.status(404).json({
        error: 'NotFound',
        message: `Ticket with ID '${ticketId}' was not found.`,
      });
      return;
    }

    if (existingTicket.reviewStatus === 'approved') {
      res.status(409).json({
        error: 'ConflictError',
        message: `Ticket '${ticketId}' has already been approved.`,
        ticket: existingTicket.toObject(),
      });
      return;
    }

    if (
      existingTicket.reviewStatus === 'needs_review' ||
      existingTicket.isUncertain ||
      !existingTicket.draftResponse ||
      existingTicket.draftResponse.trim().length === 0
    ) {
      res.status(422).json({
        error: 'ManualReviewRequired',
        message: `Ticket '${ticketId}' is flagged for mandatory manual review (status: ${existingTicket.reviewStatus}, confidence: ${existingTicket.confidence}) and cannot be directly approved without manual triage resolution.`,
      });
      return;
    }

    const effectiveReviewerId =
      req.reviewerUser?.email || validatedBody.reviewerId || 'authorized-reviewer';

    const approvedAt = new Date();
    const currentAuditLog = Array.isArray(existingTicket.auditLog)
      ? [...existingTicket.auditLog]
      : [];

    currentAuditLog.push({
      action: 'approved',
      actor: effectiveReviewerId,
      timestamp: approvedAt,
      details: `Draft response explicitly reviewed and approved for human dispatch.${
        validatedBody.reviewerNotes ? ` Notes: ${validatedBody.reviewerNotes}` : ''
      }`,
    });

    const updatedTicket = await TicketModel.findOneAndUpdate(
      {
        ticketId,
        reviewStatus: 'pending_review',
        isUncertain: false,
      },
      {
        $set: {
          reviewStatus: 'approved',
          approvalMetadata: {
            approvedBy: effectiveReviewerId,
            approvedAt,
            reviewerNotes: validatedBody.reviewerNotes || null,
          },
          auditLog: currentAuditLog,
        },
      },
      { new: true }
    ).lean();

    if (!updatedTicket) {
      res.status(409).json({
        error: 'ConflictError',
        message: `Ticket '${ticketId}' state changed concurrently and could not be approved.`,
      });
      return;
    }

    res.status(200).json({
      message: `Draft response for ticket '${ticketId}' has been approved for human dispatch. Note: no automated customer email or message has been sent.`,
      ticket: updatedTicket,
    });
  } catch (err) {
    next(err);
  }
}

export async function getDashboardMetrics(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!ensureDbConnected(res)) return;

    const [
      totalTickets,
      categoryAgg,
      priorityAgg,
      reviewStatusAgg,
      recentTickets,
    ] = await Promise.all([
      TicketModel.countDocuments({}),
      TicketModel.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      TicketModel.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      TicketModel.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$reviewStatus', count: { $sum: 1 } } },
      ]),
      TicketModel.find({}).sort({ createdAt: -1, ticketId: 1 }).limit(6).lean(),
    ]);

    const byCategory: Record<string, number> = {};
    for (const c of TICKET_CATEGORIES) byCategory[c] = 0;
    for (const row of categoryAgg) {
      if (row._id in byCategory) byCategory[row._id] = row.count;
    }

    const byPriority: Record<string, number> = {};
    for (const p of TICKET_PRIORITIES) byPriority[p] = 0;
    for (const row of priorityAgg) {
      if (row._id in byPriority) byPriority[row._id] = row.count;
    }

    const byReviewStatus: Record<string, number> = {};
    for (const s of REVIEW_STATUSES) byReviewStatus[s] = 0;
    for (const row of reviewStatusAgg) {
      if (row._id in byReviewStatus) byReviewStatus[row._id] = row.count;
    }

    const criticalAndHighCount =
      (byPriority.Critical || 0) + (byPriority.High || 0);
    const approvalRate =
      totalTickets > 0
        ? Number(((byReviewStatus.approved || 0) / totalTickets).toFixed(4))
        : 0;

    res.status(200).json({
      totalTickets,
      byCategory,
      byPriority,
      byReviewStatus,
      criticalAndHighCount,
      approvalRate,
      recentTickets,
    });
  } catch (err) {
    next(err);
  }
}

export function getEvaluationMetrics(req: Request, res: Response, next: NextFunction): void {
  try {
    const config = getConfig();
    const providedKey = extractReviewerKey(req);
    const isReviewerAuthorized =
      Boolean(providedKey) &&
      (Boolean(verifyAuthToken(providedKey as string)) ||
        (Boolean(config.reviewerApiKey) &&
          safeCompareSecrets(providedKey as string, config.reviewerApiKey)));

    // Avoid exposing raw held-out dataset labels in production unless reviewer-authorized
    const includeLabels = config.nodeEnv !== 'production' || isReviewerAuthorized;
    const evaluation = evaluateHeldOutDataset(includeLabels);

    res.status(200).json({
      evaluation,
    });
  } catch (err) {
    next(err);
  }
}
