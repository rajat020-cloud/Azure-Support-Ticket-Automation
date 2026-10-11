# Azure Support Ticket Automation (Cerevyn PS04)

> **Cerevyn — Chitkara University Round One Technical Assessment**  
> **Problem Statement**: **PS04 — Azure Support Ticket Automation**

---

## 1. Candidate Details

| Field | Value (Replace Placeholder Before Submission) |
| :--- | :--- |
| **Candidate Name** | `[YOUR_FULL_NAME_HERE]` |
| **Roll Number** | `[YOUR_UNIVERSITY_ROLL_NUMBER_HERE]` |
| **Branch / Program** | `[YOUR_BRANCH_HERE, e.g., B.E. Computer Science & Engineering]` |
| **GitHub Repository URL** | `[YOUR_GITHUB_REPOSITORY_URL_HERE]` |
| **Deployed Frontend URL (Vercel)** | `[YOUR_VERCEL_APP_URL_HERE — Pending Manual Deployment]` |
| **Deployed Backend URL (Render)** | `[YOUR_RENDER_API_URL_HERE — Pending Manual Deployment]` |
| **Demo Video Link** | `[YOUR_DEMO_VIDEO_URL_HERE]` |

---

## 2. Problem Statement & Description

Enterprise cloud support teams receive a high volume of incoming tickets spanning billing inquiries, technical outages, identity/access lockouts, and general documentation requests. Manual triage introduces delays, inconsistent prioritization, and repetitive response drafting.

**PS04 — Azure Support Ticket Automation** provides an explainable, human-in-the-loop AI-assisted REST API and operations dashboard that accepts a support ticket (`ticketId` and `message`) and deterministically produces:

1. **Predicted Category**: `Billing`, `Technical`, `Access`, or `General`
2. **Recommended Priority**: `Low`, `Medium`, `High`, or `Critical` (via an independent, context-aware priority policy)
3. **Assigned Support Team**: `Billing Support`, `Technical Support`, `Identity and Access Support`, or `General Support`
4. **Concise Issue Summary**
5. **Contextual Draft Response** (safe, non-committal, and clearly marked as a draft)
6. **Classification Confidence Proxy** (`0.15` to `0.98`) & **Matched Signal Explanation**
7. **Review Status**: `pending_review`, `needs_review` (for uncertain/ambiguous cases), or `approved`
8. **Creation, Update, and Human Approval Timestamps & Metadata**

**Strict Human-in-the-Loop Governance**:
- The system **never automatically sends emails or customer messages**.
- Draft responses remain unapproved until an authorized human reviewer explicitly confirms and signs off using a server-validated reviewer key (`POST /api/tickets/:ticketId/approve`).
- Uncertain or ambiguous tickets (`isUncertain = true`) are automatically routed to `needs_review` and blocked from direct automated draft approval (`HTTP 422`).

---

## 3. Key Features

- **Explainable Hybrid Classifier (No Python, No Paid APIs)**: Combines weighted domain phrase lexicons with TF-IDF cosine similarity trained strictly on the development corpus (`development_tickets.json`).
- **Context-Aware Priority Policy**: Evaluates urgency, service outage scope, affected user counts, security compromise indicators, and explicit deadlines independently of category—preventing false `Critical` escalations on routine questions that merely contain alarming keywords.
- **MongoDB Atlas Persistence with Mongoose**: Enforces a database-level unique index on `ticketId` (`E11000` $\rightarrow$ `HTTP 409 Conflict`), validates inputs prior to database writes, and aggregates live metrics.
- **Enterprise Operations Dashboard**: Built with React 18, TypeScript, Vite, and Tailwind CSS, featuring live KPI cards, SVG category donut chart, priority bar chart, search/filter pagination, ticket inspection drawer, human approval workflow, and live held-out evaluation report.
- **Swagger / OpenAPI 3.0 Documentation**: Interactive API explorer served at `/api/docs`.
- **Comprehensive Automated Testing**: 27 backend tests (Vitest + Supertest) and 5 frontend tests (Vitest + React Testing Library) covering all 17 mandatory assessment scenarios.

---

## 4. Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite 6, Tailwind CSS 3, Lucide Icons |
| **Backend** | Node.js ($\ge 20$), TypeScript, Express.js 4, Zod, Helmet, CORS, Express Rate Limit |
| **Database** | MongoDB Atlas with Mongoose 8 |
| **API Documentation** | Swagger UI Express (`OpenAPI 3.0.3` at `/api/docs`) |
| **Automated Testing** | Vitest, Supertest, React Testing Library, JSDOM |
| **Containerization** | Multi-stage Production `Dockerfile` (`node:20-alpine`, non-root `node` user) |
| **CI/CD** | GitHub Actions (`.github/workflows/ci.yml` and `.github/workflows/deploy-azure.yml`) |
| **Cloud & Hosting** | Vercel (Frontend), Render (Backend), Azure App Service Plan & OIDC Workflow |

---

## 5. Architecture & Repository Structure

See [`docs/architecture.md`](./docs/architecture.md) for the full request flow and Mermaid architecture diagram.

```text
.
├── .github/
│   └── workflows/
│       ├── ci.yml                      # Push/PR CI pipeline (typecheck, test, evaluate, build)
│       └── deploy-azure.yml            # Manual workflow_dispatch Azure OIDC deployment
├── backend/
│   ├── sample_data/
│   │   ├── development_tickets.json    # 24 labelled development/training tickets (6 per category)
│   │   ├── held_out_test_tickets.json  # 12 labelled held-out test tickets (3 per category)
│   │   └── ambiguous_examples.json     # 3 ambiguous edge-case tickets for manual review testing
│   ├── src/
│   │   ├── config/                     # env.ts, database.ts, swagger.ts
│   │   ├── controllers/                # ticketController.ts, healthController.ts
│   │   ├── middleware/                 # authMiddleware.ts, validateMiddleware.ts, errorMiddleware.ts
│   │   ├── models/                     # Ticket.ts (Mongoose schema & unique index)
│   │   ├── routes/                     # ticketRoutes.ts, healthRoutes.ts
│   │   ├── services/                   # classifierService.ts, priorityService.ts, routingService.ts, draftService.ts, evaluationService.ts
│   │   ├── utils/                      # runEvaluation.ts, seedDatabase.ts
│   │   ├── app.ts                      # Express app setup
│   │   └── server.ts                   # Server entrypoint
│   ├── tests/
│   │   ├── unit.services.test.ts       # 16 unit tests for classifier, priority, routing, drafts, evaluation
│   │   └── api.integration.test.ts     # 11 API tests covering all 17 mandatory HTTP scenarios
│   ├── .dockerignore
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   └── tsconfig.build.json
├── frontend/
│   ├── src/
│   │   ├── components/                 # Sidebar.tsx, Badge.tsx, TicketDetailPanel.tsx
│   │   ├── pages/                      # DashboardPage.tsx, NewTicketPage.tsx, TicketListPage.tsx, EvaluationPage.tsx, ApiDocsPage.tsx
│   │   ├── services/                   # api.ts (centralized typed API client)
│   │   ├── tests/                      # setup.ts, app.test.tsx (5 frontend tests)
│   │   ├── types/                      # ticket.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── vercel.json
│   └── vite.config.ts
├── docs/
│   ├── architecture.md                 # System architecture and Mermaid request flow
│   ├── classification-method.md        # Algorithm, dataset split, confidence formula, evaluation results
│   ├── testing.md                      # Test suites, commands, actual results, and limitations
│   ├── azure-plan.md                   # Azure App Service + Key Vault + OIDC deployment architecture
│   └── assessment-compliance.md        # Complete item-by-item PS04 compliance audit
├── .dockerignore
├── .gitignore
├── package.json                        # Root workspace convenience scripts
├── render.yaml                         # Render Blueprint for backend deployment
└── README.md
```

---

## 6. Prerequisites & Installation

### Prerequisites
- **Node.js**: `v20.0.0` or higher (verified on `v22.21.1`)
- **npm**: `v10.0.0` or higher
- **MongoDB Atlas** cluster URI (or local MongoDB instance) for running the live server
- **Docker** (optional, for building and running the backend container)

### Installation

```bash
# Install dependencies for both backend and frontend
npm run install:all
```

Or install each workspace individually:

```bash
cd backend && npm install
cd ../frontend && npm install
```

---

## 7. Environment Variables & MongoDB Atlas Setup

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env`:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/azure_support_tickets?retryWrites=true&w=majority
FRONTEND_ORIGIN=http://localhost:5173
REVIEWER_API_KEY=replace-with-local-development-secret
CONFIDENCE_THRESHOLD=0.45
```

### Frontend (`frontend/.env`)

Copy `frontend/.env.example` to `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000
```

> [!WARNING]
> Never expose `REVIEWER_API_KEY` or `MONGODB_URI` in frontend code or `VITE_` variables.

### MongoDB Atlas Setup

1. Sign in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create a free `M0` cluster.
2. Under **Database Access**, create a database user with `readWrite` permissions on the `azure_support_tickets` database.
3. Under **Network Access**, add your local IP address for local development.
4. Copy the connection string (`mongodb+srv://...`) into `backend/.env` as `MONGODB_URI`.
5. When the backend starts, `connectToDatabase()` automatically calls `TicketModel.init()` to build the unique index on `ticketId`.

---

## 8. Local Development, Testing & Evaluation Commands

### Run Locally

```bash
# Terminal 1 — Start the backend API on http://localhost:5000
npm run dev:backend

# (Optional) Seed sample fictional tickets into MongoDB
npm run seed

# Terminal 2 — Start the React frontend on http://localhost:5173
npm run dev:frontend
```

### Run Automated Tests & Production Builds

```bash
# Run all backend (27 tests) and frontend (5 tests) suites
npm test

# Run backend tests only
npm run test:backend

# Run frontend tests only
npm run test:frontend

# Run TypeScript compiler checks
npm run typecheck

# Run production builds for both backend and frontend
npm run build
```

### Run Held-Out Classifier Evaluation

```bash
npm run evaluate
```

**Actual Executed Held-Out Evaluation Output (`held_out_test_tickets.json`)**:
- **Total Held-Out Test Tickets**: `12` (`3` Billing, `3` Technical, `3` Access, `3` General)
- **Category Accuracy**: `12 / 12` (**100.00%**)
- **Priority Accuracy**: `12 / 12` (**100.00%**)
- **Team Routing Accuracy**: `12 / 12` (**100.00%**)
- See [`docs/classification-method.md`](./docs/classification-method.md) for the full confusion matrix, per-category precision/recall/F1 table, and limitations of small synthetic datasets.

---

## 9. REST API Endpoints & Example Payloads

Interactive Swagger documentation is available at `http://localhost:5000/api/docs`.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Returns service health and MongoDB connection status (`200` or `503`). |
| `POST` | `/api/tickets` | Public | Validates, classifies, prioritizes, assigns team, generates summary & draft, and stores in MongoDB (`201`, `400`, `409`). |
| `GET` | `/api/tickets` | Public | Lists tickets with `page`, `limit`, `search`, `category`, `priority`, `reviewStatus` filters. |
| `GET` | `/api/tickets/:ticketId` | Public | Retrieves a single ticket by `ticketId` (`200` or `404`). |
| `POST` | `/api/tickets/:ticketId/approve` | `x-reviewer-api-key` | Approves an eligible draft (`200`, `401`, `403`, `404`, `409`, `422`). |
| `GET` | `/api/metrics` | Public | Returns live MongoDB aggregate counts by category, priority, and review status. |
| `GET` | `/api/evaluation` | Public | Executes classifier against `held_out_test_tickets.json` and returns evaluation metrics. |
| `GET` | `/api/docs` | Public | Swagger / OpenAPI 3.0 UI. |

### Example: Create a Ticket (`POST /api/tickets`)

**Request**:
```json
{
  "ticketId": "TCK-1001",
  "message": "I cannot access my account after resetting my password."
}
```

**Response (`HTTP 201 Created`)**:
```json
{
  "ticket": {
    "ticketId": "TCK-1001",
    "message": "I cannot access my account after resetting my password.",
    "category": "Access",
    "priority": "High",
    "assignedTeam": "Identity and Access Support",
    "summary": "[Access | High] Customer reported: \"I cannot access my account after resetting my password\". Assigned to Identity and Access Support. Key indicators: password, resetting my password, cannot.",
    "draftResponse": "[DRAFT — AWAITING HUMAN REVIEW & APPROVAL]\nHello,\n\nThank you for reaching out to Azure Support regarding Ticket TCK-1001 (\"I cannot access my account after resetting my password\").\n\nBecause this request has been prioritized as High, it has been flagged for expedited review within the Identity and Access Support queue. An Identity and Access Support specialist will review the authentication, permission, or directory configuration details while adhering to our security verification policies.\n\nPlease note that this is an initial acknowledgment and no account, billing, or infrastructure changes have been executed yet. If you have additional logs, correlation IDs, or context to add in the meantime, please reply referencing Ticket TCK-1001.\n\nBest regards,\nIdentity and Access Support",
    "confidence": 0.98,
    "classificationExplanation": "Matched signals: password, resetting my password, cannot, access, resetting. High-margin match for Access category (confidence proxy 0.98, runner-up Technical score 0.00). High priority assigned due to active account lockout, severe service degradation, or an explicit near-term deadline/suspension risk.",
    "matchedSignals": ["password", "resetting my password", "cannot", "access", "resetting"],
    "prioritySignals": ["active_account_lockout"],
    "isUncertain": false,
    "reviewStatus": "pending_review",
    "approvalMetadata": {
      "approvedBy": null,
      "approvedAt": null,
      "reviewerNotes": null
    },
    "createdAt": "2026-10-11T16:15:00.000Z",
    "updatedAt": "2026-10-11T16:15:00.000Z"
  }
}
```

### Example: Approve a Draft (`POST /api/tickets/TCK-1001/approve`)

**Headers**:
```http
Content-Type: application/json
x-reviewer-api-key: replace-with-local-development-secret
```

**Request**:
```json
{
  "approved": true,
  "reviewerId": "senior-reviewer@example.com",
  "reviewerNotes": "Verified user lock status in Entra ID; draft is accurate."
}
```

---

## 10. Docker Instructions

Build and run the production backend container from `./backend`:

```bash
# Build the backend Docker image
docker build -t azure-ticket-automation-backend ./backend

# Run the container (requires MONGODB_URI and REVIEWER_API_KEY)
docker run --rm -p 5000:5000 \
  -e NODE_ENV=production \
  -e PORT=5000 \
  -e MONGODB_URI="mongodb+srv://<username>:<password>@<cluster>.mongodb.net/azure_support_tickets" \
  -e FRONTEND_ORIGIN="http://localhost:5173" \
  -e REVIEWER_API_KEY="your-secret-reviewer-key" \
  azure-ticket-automation-backend
```

If `MONGODB_URI` or `REVIEWER_API_KEY` (in production mode) is omitted, the container fails fast with a clear `[FATAL]` startup error message.

---

## 11. GitHub Actions CI & Azure OIDC Workflows

1. **Continuous Integration (`.github/workflows/ci.yml`)**:
   - Triggers automatically on every `push` and `pull_request`.
   - Installs locked dependencies (`npm ci`), runs TypeScript checks, executes all 27 backend and 5 frontend tests, runs `npm run evaluate`, and builds both production bundles.
   - **How to Inspect Results**: Open your GitHub repository $\rightarrow$ click the **Actions** tab $\rightarrow$ select **CI — Build, Typecheck & Automated Tests** to inspect step-by-step logs.
2. **Manual Azure OIDC Deployment (`.github/workflows/deploy-azure.yml`)**:
   - Uses `workflow_dispatch` (manual trigger only) and authenticates to Azure via OpenID Connect (`azure/login@v2`) with federated credentials.
   - See [`docs/azure-plan.md`](./docs/azure-plan.md) for the complete Entra ID federated credential and App Service setup guide.

---

## 12. Render Backend Deployment Guide

A `render.yaml` Blueprint is included at the repository root. To deploy manually or via Blueprint:

1. **Create Service from GitHub**: Log in to [Render](https://render.com/), click **New + $\rightarrow$ Web Service**, and connect your GitHub repository.
2. **Configure Build & Runtime Settings**:
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
3. **Configure Environment Variables in Render**:
   - `NODE_ENV` = `production`
   - `CONFIDENCE_THRESHOLD` = `0.45`
   - `MONGODB_URI` = your MongoDB Atlas `mongodb+srv://...` connection string
   - `REVIEWER_API_KEY` = a strong random secret key for draft approvals
   - `FRONTEND_ORIGIN` = your deployed Vercel URL (e.g., `https://your-project.vercel.app`)
4. **Configure MongoDB Atlas Network Access**:
   - Copy your Render service's **Outbound Static IP Addresses** from the Render Dashboard (*Connect $\rightarrow$ Outbound*) and add them to **MongoDB Atlas $\rightarrow$ Network Access $\rightarrow$ IP Access List** (preferring specific outbound IPs over `0.0.0.0/0`).
5. **Deploy & Inspect Logs**: Click **Deploy Web Service** and verify in the Render logs that `[DB] Connected to MongoDB` and `[SERVER] ... listening on http://0.0.0.0:<PORT>` appear.
6. **Verify `/api/health`**: Visit `https://<your-render-service>.onrender.com/api/health` and confirm `{"status":"healthy","database":{"connected":true,"state":"connected"}}`.
7. **Test Ticket Creation & Retrieval**: Send a `POST` request to `/api/tickets` and `GET` `/api/tickets` to verify end-to-end persistence.

---

## 13. Vercel Frontend Deployment Guide

1. **Import Repository into Vercel**: Log in to [Vercel](https://vercel.com/), click **Add New... $\rightarrow$ Project**, and import your GitHub repository.
2. **Set Frontend Root Directory**: Set **Root Directory** to `frontend`.
3. **Configure Build Settings**:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Add Production Environment Variable**:
   - Add `VITE_API_BASE_URL` = `https://<your-actual-render-backend>.onrender.com` (no trailing slash).
5. **Routing Rules**: `frontend/vercel.json` is pre-configured to rewrite SPA routes to `/index.html`.
6. **Deploy the Frontend**: Click **Deploy** and note your assigned `.vercel.app` URL.
7. **Update Render CORS**: In your Render backend environment variables, set `FRONTEND_ORIGIN` to your exact Vercel URL (`https://<your-app>.vercel.app`) and save.
8. **Redeploy When Environment Variables Change**: Whenever `VITE_API_BASE_URL` is changed in Vercel, trigger a new deployment so Vite embeds the updated URL at build time.
9. **Verify Deployed Workflow**: Open the Vercel URL, submit a ticket, inspect its classification, and approve a draft using your `REVIEWER_API_KEY`.

---

## 14. Security Considerations & Known Limitations

- **Reviewer Authorization Mechanism**: The `POST /api/tickets/:ticketId/approve` endpoint validates the `x-reviewer-api-key` header (or Bearer token) against `process.env.REVIEWER_API_KEY` using `crypto.timingSafeEqual`. While suitable for this technical assessment, a shared API key is a limited demo mechanism and not a replacement for enterprise RBAC/OIDC identity management (e.g., Microsoft Entra ID).
- **No Credential Exposure**: Database connection errors are sanitized before logging, and secrets are never exposed in API responses or `VITE_` variables.
- **Classifier Scope**: The hybrid TF-IDF + domain lexicon classifier is evaluated on a 36-ticket synthetic dataset (`24` dev, `12` held-out test). It is an explainable baseline, not a statistical deep-learning model.

---

## 15. 3–5 Minute Demo Recording Script

Use this step-by-step script to record your 3–5 minute assessment walkthrough:

1. **Create a Valid Support Ticket (0:00 – 0:40)**:
   - Open the application (`New Ticket` tab), click the **Access (Password & MFA Lockout)** preset (`TCK-1001`: *"I cannot access my account after resetting my password. The MFA authenticator code is being rejected."*), and click **Classify & Create Ticket**.
2. **Inspect Category, Priority, Team, Summary & Draft Response (0:40 – 1:15)**:
   - Point out the right-hand **Ticket Details** drawer showing `Category: Access`, `Priority: High`, `Assigned Team: Identity and Access Support`, `Confidence: 0.98`, matched signals, concise summary, and the draft response marked `[DRAFT — AWAITING HUMAN REVIEW & APPROVAL]`.
3. **Submit an Ambiguous Ticket (1:15 – 1:45)**:
   - Select the **Ambiguous (Routes to Manual Review)** preset (`TCK-1005`: *"Need help urgently with our portal, something is wrong and we cannot proceed."*) and submit.
4. **Show Mandatory Human Review Blocking (1:45 – 2:10)**:
   - Highlight the red **Needs Review** badge and warning alert in **Ticket Details** explaining that low-confidence / vague tickets are blocked from direct draft approval (`HTTP 422` if called via API).
5. **Attempt a Duplicate Ticket ID (2:10 – 2:30)**:
   - Resubmit `TCK-1001` on the **New Ticket** form and show the `Duplicate Ticket ID (HTTP 409 Conflict)` error banner enforced by the MongoDB unique index.
6. **Submit Invalid Input (2:30 – 2:45)**:
   - Clear the message field and click submit to show client-side validation, or send an empty message via curl/Swagger to show `HTTP 400 ValidationError`.
7. **Approve an Eligible Draft (2:45 – 3:25)**:
   - Select `TCK-1001` (`Pending Review`), enter the `REVIEWER_API_KEY`, check the explicit confirmation checkbox, and click **Approve Draft Response**. Show that the status updates to **Approved** in MongoDB with `Reviewed By` and `Reviewed At` metadata, and note that no email is automatically sent.
8. **View Actual Held-Out Classification Metrics (3:25 – 3:55)**:
   - Navigate to the **Evaluation** tab (and/or run `npm run evaluate` in the terminal) to show the live held-out test set accuracy (`12/12`), per-category precision/recall/F1 table, and 4x4 confusion matrix.
9. **Run Automated Tests (3:55 – 4:25)**:
   - In the terminal, run `npm test` and show all **27 backend tests** and **5 frontend tests** passing.
10. **Show GitHub Actions CI & Azure Plan (4:25 – 4:50)**:
    - Show `.github/workflows/ci.yml`, `.github/workflows/deploy-azure.yml`, and the GitHub Actions tab once pushed to GitHub.

---

## 16. AI-Assistance & Reused-Code Disclosure

- **AI-Assistance Disclosure**: This project structure, TypeScript implementation, synthetic support ticket dataset (`development_tickets.json`, `held_out_test_tickets.json`, `ambiguous_examples.json`), automated test suites, and technical documentation were developed with the assistance of an AI coding assistant in accordance with the PS04 assessment guidelines. All code, tests, classifier evaluations, and builds were executed and verified in the project workspace.
- **Third-Party Libraries**: Uses standard open-source npm packages (`express`, `mongoose`, `zod`, `helmet`, `cors`, `swagger-ui-express`, `react`, `lucide-react`, `tailwindcss`, `vitest`, `supertest`). No proprietary datasets or paid external AI APIs are used.

---

## 17. Final Assessment-Compliance Status

See [`docs/assessment-compliance.md`](./docs/assessment-compliance.md) for the complete 21-point requirement-by-requirement verification table.
