# Classification, Priority & Routing Methodology

## 1. Overview & Design Philosophy

To satisfy the PS04 assessment requirements without relying on Python, external model downloads, or paid LLM APIs, the backend implements a **deterministic, explainable hybrid classification engine** in TypeScript (`backend/src/services/classifierService.ts`), paired with an independent **priority policy** (`backend/src/services/priorityService.ts`) and **team-routing policy** (`backend/src/services/routingService.ts`).

> [!IMPORTANT]
> This classifier is a lightweight, explainable baseline engineered for transparency and deterministic triage. Its confidence output is a **heuristic confidence proxy** (`0.15` to `0.98`), not a statistically calibrated probability distribution. Summaries and draft responses are automated templates awaiting human review, not guaranteed factual conclusions.

---

## 2. Dataset Split & Anti-Leakage Policy

The synthetic dataset is stored under `backend/sample_data/` and contains **36 labelled support tickets** across all four mandatory categories (`Billing`, `Technical`, `Access`, `General`), plus **3 additional ambiguous edge-case examples**:

1. **Development / Training Set (`backend/sample_data/development_tickets.json`)**:
   - **24 labelled tickets** (`DEV-1001` through `DEV-1024`), evenly distributed with **6 tickets per category** (`Billing`, `Technical`, `Access`, `General`).
   - Used to construct the TF-IDF vocabulary, smoothed inverse document frequency (IDF) weights, and L2-normalized category centroid vectors.
2. **Held-Out Test Set (`backend/sample_data/held_out_test_tickets.json`)**:
   - **12 labelled tickets** (`TEST-2001` through `TEST-2012`), evenly distributed with **3 tickets per category** (`Billing`, `Technical`, `Access`, `General`) and spanning all four priority levels (`Low`, `Medium`, `High`, `Critical`).
   - Strictly isolated from the TF-IDF training step (`buildTfIdfModelFromDevData()` only loads `development_tickets.json`).
   - The split was established prior to running evaluation, and no ticket IDs or held-out labels are hardcoded in the classifier.
3. **Ambiguous Examples (`backend/sample_data/ambiguous_examples.json`)**:
   - **3 unlabelled/edge-case tickets** (`AMB-3001` through `AMB-3003`) representing vague requests and multi-category overlap to verify mandatory human review routing (`needs_review`).

---

## 3. Input Normalization & Feature Extraction

When `classifyTicketMessage(rawMessage)` is invoked:

1. **Input Validation**: Rejects non-string, empty, or whitespace-only inputs immediately by throwing an error (also enforced at the API boundary by Zod).
2. **Normalization (`normalizeText`)**:
   - Converts text to lowercase.
   - Replaces punctuation (except internal hyphens and slashes used in error codes or paths like `502`, `INV-88421`, `/v2/reports`) with spaces.
   - Collapses repeated whitespace into single spaces.
3. **Tokenization & Stopword Filtering (`tokenize`)**:
   - Splits text into tokens of length $\ge 2$.
   - Removes common English conversational stopwords and generic support words (`hello`, `please`, `help`, `need`, `issue`, `problem`, `portal`, `account`) so generic phrasing does not skew category centroids.

---

## 4. Hybrid Scoring & Confidence Proxy Calculation

For each of the four categories $c \in \{\text{Billing}, \text{Technical}, \text{Access}, \text{General}\}$:

1. **Domain Lexicon Score ($S_{\text{lex}}(c)$)**:
   - Sums the weights of matched domain-specific single-word tokens and multi-word phrases defined in `DOMAIN_LEXICON` (e.g., `invoice` $[3.0]$, `charged` $[3.0]$ for Billing; `502` $[3.0]$, `memory leak` $[3.2]$, `crash` $[2.8]$ for Technical; `password` $[3.2]$, `mfa` $[3.2]$, `sso` $[3.2]$, `locked out` $[3.2]$ for Access; `roadmap` $[3.2]$, `soc 2` $[3.0]$, `user guides` $[3.0]$ for General).
2. **Development-Set TF-IDF Cosine Similarity ($S_{\text{tfidf}}(c)$)**:
   - Computes the cosine similarity $\cos(\theta) \in [0, 1]$ between the query's TF-IDF vector and the category centroid vector built from `development_tickets.json`.
3. **Combined Category Score ($S(c)$)**:
   $$S(c) = S_{\text{lex}}(c) + 6.0 \times S_{\text{tfidf}}(c)$$
4. **Confidence Proxy Calculation**:
   Let $S_1$ be the highest category score, $S_2$ be the runner-up category score, and $S_{\text{total}} = \sum_c S(c)$.
   - If $S_1 < 0.8$ or fewer than 2 meaningful tokens exist, the classifier defaults to `General` with confidence proxy `0.20` and `isUncertain = true`.
   - Otherwise, it computes three components:
     - **Signal Strength Factor**: $\text{strength} = \min(1.0, S_1 / 7.5)$
     - **Dominance Ratio**: $\text{dominance} = S_1 / S_{\text{total}}$
     - **Runner-Up Margin Ratio**: $\text{margin} = (S_1 - S_2) / S_1$
   - The confidence proxy is bounded to $[0.15, 0.98]$:
     $$\text{confidence} = \text{clamp}(0.45 \times \text{strength} + 0.30 \times \text{dominance} + 0.25 \times \text{margin},\ 0.15,\ 0.98)$$

---

## 5. Confidence Threshold & Ambiguity Handling

The default confidence threshold is `CONFIDENCE_THRESHOLD = 0.45` (configurable via environment variable). A ticket is marked `isUncertain = true` and routed to `reviewStatus = 'needs_review'` if **any** of the following hold:

1. **Low Signal / Vague Input**: Top category score $S_1 < 0.8$ or token count $< 2$ (e.g., *"Need help urgently with our portal, something is wrong"*).
2. **Below Confidence Threshold**: $\text{confidence} < \text{CONFIDENCE\_THRESHOLD}$.
3. **Cross-Category Conflict (Narrow Margin)**: Runner-up category has strong competing signals ($S_2 \ge 2.8$) and the relative separation margin is narrow ($\text{margin} < 0.25$), such as *"I cannot log into the billing portal to download my invoice because the page crashes with a 500 error"*.

When a ticket is uncertain:
- The best candidate category is retained as a provisional suggestion, but `reviewStatus` is set to `'needs_review'`.
- The generated draft response explicitly requests clarification and notes that human specialist triage is required.
- The approval endpoint (`POST /api/tickets/:ticketId/approve`) blocks direct approval with `HTTP 422 Unprocessable Entity (ManualReviewRequired)`.

---

## 6. Deterministic Priority Policy

Implemented in `backend/src/services/priorityService.ts`, priority is evaluated **independently** of category based on six operational dimensions: urgency, business impact, service disruption, security/account-access concerns, affected user counts, and explicit deadlines:

| Priority Level | Deterministic Criteria |
| :--- | :--- |
| **Critical** | Requires **corroborated severe evidence**: (a) Production outage, cluster crash, or SSO federation failure combined with widespread scope ($\ge 50$ affected users, `"all regional endpoints"`, `"entire ... team"`, or `"complete ... outage"`), **OR** (b) Active security compromise (`"unauthorized"`, `"compromised"`, `"security breach"`) requiring immediate credential/token revocation. *Note: Alarming words like `"URGENT"` or `"CRITICAL"` alone without outage or security evidence do NOT trigger Critical priority.* |
| **High** | Assigned when there is: (a) Active individual account lockout (`"cannot log into"`, `"cannot access my account"`, `"locked out"`, expired/rejected password reset or MFA token), **OR** (b) Severe technical degradation (`"crashing"`, `"outofmemory"`, `"memory leak"`, `"high cpu"`, `"latency spiked"`, `"connection pool exhaustion"`), **OR** (c) An explicit near-term deadline or suspension/termination warning (`"tomorrow"`, `"in 24 hours"`, `"suspended"`, `"terminated"`). |
| **Medium** | Assigned for: (a) Billing discrepancies, duplicate charges, overages, or unexpected cost jumps, **OR** (b) Isolated or non-production technical/permission errors (`"504"`, `"timeout"`, `"403 forbidden"`, `"webhook"`, `"tls"`, `"cron"`, lost 2FA device replacement), **OR** (c) Formal compliance audit requests (`"SOC 2"`, `"GDPR"`). |
| **Low** | Assigned to routine administrative requests, PDF receipt/tax updates, standard RBAC role grants, product roadmap/documentation inquiries, training/webinar scheduling, or minor non-blocking UI bugs. |

---

## 7. Team Routing Rules

Implemented in `backend/src/services/routingService.ts`:

- `Billing` $\rightarrow$ **Billing Support**
- `Technical` $\rightarrow$ **Technical Support**
- `Access` $\rightarrow$ **Identity and Access Support**
- `General` $\rightarrow$ **General Support**

---

## 8. Actual Held-Out Evaluation Results

Executed via `npm run evaluate --prefix backend` against `backend/sample_data/held_out_test_tickets.json`:

- **Total Held-Out Test Tickets**: `12` (`3` Billing, `3` Technical, `3` Access, `3` General)
- **Correct Category Predictions**: `12 / 12` (**100.00%**)
- **Correct Priority Predictions**: `12 / 12` (**100.00%**)
- **Correct Team Assignments**: `12 / 12` (**100.00%**)

### Per-Category Metrics

| Category | Expected | Predicted | TP | FP | FN | Precision | Recall | F1 Score |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Billing** | 3 | 3 | 3 | 0 | 0 | 100.0% | 100.0% | 1.0000 |
| **Technical** | 3 | 3 | 3 | 0 | 0 | 100.0% | 100.0% | 1.0000 |
| **Access** | 3 | 3 | 3 | 0 | 0 | 100.0% | 100.0% | 1.0000 |
| **General** | 3 | 3 | 3 | 0 | 0 | 100.0% | 100.0% | 1.0000 |

### Confusion Matrix (Rows = Actual Expected, Columns = Predicted)

| Actual \ Predicted | Billing | Technical | Access | General |
| :--- | :---: | :---: | :---: | :---: |
| **Billing** | **3** | 0 | 0 | 0 |
| **Technical** | 0 | **3** | 0 | 0 |
| **Access** | 0 | 0 | **3** | 0 |
| **General** | 0 | 0 | 0 | **3** |

---

## 9. Limitations & Future Improvements

1. **Small Synthetic Dataset Limitation**: Although `12/12` (100%) accuracy is achieved on the held-out set, the evaluation dataset consists of 12 synthetic tickets written with clear domain terminology. In real-world production environments with thousands of noisy, multilingual, or typographical customer messages, accuracy would be lower.
2. **Bag-of-Words & Lexicon Constraints**: The hybrid TF-IDF and phrase lexicon approach does not capture deep syntactic negation (e.g., *"This is NOT a billing invoice problem, it is a technical crash"*) beyond competing-signal margin detection.
3. **Future Improvements**:
   - Expand the labelled dataset to several hundred historical tickets with multi-annotator agreement.
   - Calibrate confidence scores using Platt scaling or isotonic regression on a validation fold.
   - Add an editorial workflow allowing human reviewers to override the predicted category/priority and edit the draft text before approval.
