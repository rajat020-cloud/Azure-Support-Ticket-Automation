# Automated Testing Documentation

## 1. Test Tools & Frameworks

- **Backend Test Runner**: [Vitest](https://vitest.dev/) (`^3.0.4`)
- **HTTP API Assertion Library**: [Supertest](https://github.com/ladjs/supertest) (`^7.0.0`)
- **Frontend Test Runner & DOM Environment**: Vitest + `jsdom` + `@testing-library/react` + `@testing-library/jest-dom`

---

## 2. Test Setup & Isolation Strategy

All automated tests are designed to be **reproducible, deterministic, and credential-free**:

1. **No Production Credentials Required**: Neither backend nor frontend test suites require a live `MONGODB_URI` or production secrets.
2. **Backend Unit Tests (`backend/tests/unit.services.test.ts`)**:
   - Directly test `classifierService.ts`, `priorityService.ts`, `routingService.ts`, `draftService.ts`, and `evaluationService.ts` against real sample data in `backend/sample_data/`.
3. **Backend API Endpoint Tests (`backend/tests/api.integration.test.ts`)**:
   - Execute real HTTP requests through the Express middleware, Zod validation, timing-safe authentication, and controller stack using Supertest (`createApp()`).
   - Use a **stateful Mongoose Repository Test Double** (`vi.spyOn(TicketModel, ...)`) that faithfully enforces the unique index constraint on `ticketId` (throwing MongoDB `E11000` duplicate key errors), regex search, filter predicates, deterministic sorting, pagination, and atomic approval updates.
   - *Explicit Disclosure*: These API tests verify the complete HTTP and controller layer using a stateful Mongoose repository test double rather than a live remote MongoDB Atlas cluster, ensuring CI and local test runs never mutate production data or fail due to external network firewalls.
4. **Frontend Tests (`frontend/src/tests/app.test.tsx`)**:
   - Render actual React components (`NewTicketPage`, `TicketDetailPanel`, `DashboardPage`) in `jsdom` and verify client-side validation, duplicate ticket ID (`HTTP 409`) error alerts, mandatory manual review blocking (`needs_review`), and explicit human confirmation before draft approval.

---

## 3. Test Commands

From the repository root:

```bash
# Run both backend and frontend test suites
npm test

# Run backend tests only
npm run test:backend

# Run frontend tests only
npm run test:frontend

# Run TypeScript compiler checks across both workspaces
npm run typecheck
```

---

## 4. Implemented Test Scenarios (17+ Backend & 5 Frontend)

### Backend Unit Tests (`backend/tests/unit.services.test.ts` — 16 tests)

1. Deterministic text normalization (casing, punctuation, whitespace).
2. Explicit error thrown on empty or whitespace-only input.
3. Representative `Billing` ticket classification and signal extraction.
4. Representative `Technical` ticket classification and signal extraction.
5. Representative `Access` ticket classification and signal extraction.
6. Representative `General` ticket classification and signal extraction.
7. Deterministic repeatability for identical inputs.
8. Ambiguous vague message detection (`isUncertain = true`).
9. Cross-category competing signal detection (`isUncertain = true`).
10. `Critical` priority assignment for corroborated widespread outage and security compromise.
11. Prevention of false `Critical` priority when alarming keywords appear in a routine request.
12. `High` priority assignment for individual account lockout and imminent suspension deadlines.
13. `Medium` priority assignment for billing discrepancies and isolated technical errors.
14. Team routing across all 4 categories and `pending_review` / `needs_review` status assignment.
15. Safe contextual summary and draft response generation without promising refunds or claiming resolution.
16. Held-out dataset evaluation calculation (`held_out_test_tickets.json`, 12 tickets across all 4 categories).

### Backend API Tests (`backend/tests/api.integration.test.ts` — 11 comprehensive multi-step tests covering Scenarios 1–17)

1. **Scenarios 1–4**: `POST /api/tickets` creates a valid ticket (`HTTP 201`) with predicted category, priority, assigned team, summary, and draft response.
2. **Scenario 5**: Rejects missing `ticketId` (`HTTP 400 ValidationError`).
3. **Scenario 6**: Rejects empty customer `message` (`HTTP 400 ValidationError`).
4. **Scenario 7**: Rejects malformed JSON body (`HTTP 400 ValidationError`).
5. **Scenario 8**: Rejects duplicate `ticketId` (`HTTP 409 ConflictError`).
6. **Scenarios 9 & 12**: Routes ambiguous ticket to `needs_review` and blocks `POST /api/tickets/:ticketId/approve` with `HTTP 422 ManualReviewRequired`.
7. **Scenarios 10, 11, 17**: Rejects missing reviewer key (`HTTP 401`), rejects invalid reviewer key (`HTTP 403`), approves eligible ticket with valid key (`HTTP 200`), and rejects repeated approval on an already-approved ticket (`HTTP 409 ConflictError`).
8. **Scenario 13**: Returns `HTTP 404 NotFound` for nonexistent `ticketId`.
9. **Scenario 14**: Verifies pagination, search query, category filter, and `GET /api/metrics` aggregate counts.
10. **Scenario 15**: Verifies database-unavailable behavior (`HTTP 503` on `/api/health` and `POST /api/tickets`).
11. **Scenario 16**: Verifies held-out evaluation endpoint (`GET /api/evaluation`).

### Frontend Tests (`frontend/src/tests/app.test.tsx` — 5 tests)

1. Client-side validation for empty `ticketId` and empty customer message on `NewTicketPage`.
2. Duplicate ticket ID (`HTTP 409 Conflict`) error alert display on `NewTicketPage`.
3. Requirement of explicit confirmation checkbox and reviewer key before submitting draft approval in `TicketDetailPanel`.
4. Blocking of approval form and display of manual review warning when `reviewStatus === 'needs_review'`.
5. Accurate rendering of live dashboard metrics and recent tickets on `DashboardPage`.

---

## 5. Actual Executed Test Results

Both test suites were executed locally and verified to pass with exit code `0`:

- **Backend Suite (`npm run test --prefix backend`)**:
  - `tests/unit.services.test.ts`: **16 passed (16)**
  - `tests/api.integration.test.ts`: **11 passed (11)**
  - **Total Backend**: **2 files passed, 27 tests passed, 0 failed**
- **Frontend Suite (`npm run test --prefix frontend`)**:
  - `src/tests/app.test.tsx`: **5 passed (5)**
  - **Total Frontend**: **1 file passed, 5 tests passed, 0 failed**

---

## 6. Continuous Integration Behavior & Known Limitations

- **GitHub Actions CI (`.github/workflows/ci.yml`)**: Runs `npm ci`, `npm run typecheck`, `npm test`, `npm run evaluate`, and `npm run build` across both `backend` and `frontend` on every push and pull request. Any failing test or type error causes the workflow to exit with a non-zero status code and fail the build.
- **Known Testing Limitations**:
  - Because CI runners and unconfigured local checkouts do not have access to a private MongoDB Atlas cluster, automated API tests use a stateful Mongoose repository test double (`api.integration.test.ts`) rather than connecting over the internet to MongoDB Atlas. Live MongoDB Atlas persistence must be verified after configuring `MONGODB_URI` in `.env` or Render.
