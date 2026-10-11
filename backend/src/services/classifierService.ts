import fs from 'fs';
import path from 'path';
import { TicketCategory, TICKET_CATEGORIES } from '../models/Ticket';
import { getConfig } from '../config/env';

export interface ClassificationResult {
  category: TicketCategory;
  confidence: number;
  isUncertain: boolean;
  uncertaintyReason: string | null;
  explanation: string;
  matchedSignals: string[];
  categoryScores: Record<TicketCategory, number>;
}

interface DevelopmentRecord {
  ticketId: string;
  message: string;
  expectedCategory: TicketCategory;
}

interface WeightedTerm {
  phrase: string;
  weight: number;
}

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can', 'could',
  'did', 'do', 'does', 'for', 'from', 'had', 'has', 'have', 'he', 'her', 'here',
  'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'just', 'me',
  'my', 'no', 'not', 'of', 'on', 'or', 'our', 'out', 'please', 'so', 'some',
  'such', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these',
  'they', 'this', 'to', 'too', 'up', 'us', 'very', 'was', 'we', 'were', 'what',
  'when', 'where', 'which', 'who', 'why', 'will', 'with', 'would', 'you', 'your',
  'hello', 'hi', 'team', 'help', 'need', 'issue', 'problem', 'portal', 'account'
]);

const DOMAIN_LEXICON: Record<TicketCategory, WeightedTerm[]> = {
  Billing: [
    { phrase: 'invoice', weight: 3.0 },
    { phrase: 'invoicing', weight: 2.8 },
    { phrase: 'charged', weight: 3.0 },
    { phrase: 'charge', weight: 2.4 },
    { phrase: 'billing', weight: 3.2 },
    { phrase: 'bill', weight: 2.5 },
    { phrase: 'payment', weight: 2.8 },
    { phrase: 'refund', weight: 3.0 },
    { phrase: 'credit card', weight: 3.0 },
    { phrase: 'subscription', weight: 2.0 },
    { phrase: 'receipt', weight: 2.8 },
    { phrase: 'receipts', weight: 2.8 },
    { phrase: 'tax', weight: 2.5 },
    { phrase: 'gst', weight: 2.6 },
    { phrase: 'vat', weight: 2.6 },
    { phrase: 'overage', weight: 3.0 },
    { phrase: 'promo code', weight: 2.6 },
    { phrase: 'pricing', weight: 2.4 },
    { phrase: 'statement', weight: 2.4 },
    { phrase: 'wire transfer', weight: 2.8 },
    { phrase: 'purchase order', weight: 2.6 },
    { phrase: 'ach', weight: 2.8 },
    { phrase: 'bounced', weight: 2.2 },
    { phrase: 'renewal', weight: 2.2 },
    { phrase: 'license fee', weight: 2.6 },
    { phrase: 'license fees', weight: 2.6 },
    { phrase: 'cost', weight: 2.0 },
  ],
  Technical: [
    { phrase: '502', weight: 3.0 },
    { phrase: '504', weight: 3.0 },
    { phrase: '500', weight: 2.8 },
    { phrase: 'bad gateway', weight: 3.2 },
    { phrase: 'gateway timeout', weight: 3.2 },
    { phrase: 'timeout', weight: 2.4 },
    { phrase: 'outage', weight: 2.8 },
    { phrase: 'crash', weight: 2.8 },
    { phrase: 'crashed', weight: 2.8 },
    { phrase: 'crashing', weight: 2.8 },
    { phrase: 'crashes', weight: 2.8 },
    { phrase: 'api', weight: 2.2 },
    { phrase: 'endpoint', weight: 2.4 },
    { phrase: 'endpoints', weight: 2.4 },
    { phrase: 'webhook', weight: 2.8 },
    { phrase: 'tls', weight: 2.6 },
    { phrase: 'outofmemory', weight: 3.2 },
    { phrase: 'memory leak', weight: 3.2 },
    { phrase: 'cpu', weight: 2.6 },
    { phrase: 'latency', weight: 2.8 },
    { phrase: 'database', weight: 2.4 },
    { phrase: 'connection pool', weight: 2.8 },
    { phrase: 'typeerror', weight: 3.0 },
    { phrase: 'cron', weight: 2.6 },
    { phrase: 'kernel panic', weight: 3.2 },
    { phrase: 'cluster', weight: 2.4 },
    { phrase: 'container', weight: 2.2 },
    { phrase: 'worker', weight: 2.2 },
    { phrase: 'pods', weight: 2.4 },
    { phrase: 'bug', weight: 2.5 },
    { phrase: 'exception', weight: 2.6 },
    { phrase: 'exceptions', weight: 2.6 },
    { phrase: 'payload', weight: 2.2 },
    { phrase: 'socket', weight: 2.4 },
  ],
  Access: [
    { phrase: 'password', weight: 3.2 },
    { phrase: 'resetting my password', weight: 3.5 },
    { phrase: 'password reset', weight: 3.5 },
    { phrase: 'mfa', weight: 3.2 },
    { phrase: '2fa', weight: 3.2 },
    { phrase: 'two-factor', weight: 3.2 },
    { phrase: 'authenticator', weight: 3.0 },
    { phrase: 'rbac', weight: 3.2 },
    { phrase: 'permissions', weight: 2.8 },
    { phrase: 'permission', weight: 2.8 },
    { phrase: 'locked out', weight: 3.2 },
    { phrase: 'sso', weight: 3.2 },
    { phrase: 'single sign-on', weight: 3.2 },
    { phrase: 'saml', weight: 3.0 },
    { phrase: 'entra', weight: 2.8 },
    { phrase: 'aadsts', weight: 3.2 },
    { phrase: 'sign in', weight: 2.6 },
    { phrase: 'log into', weight: 2.6 },
    { phrase: 'login', weight: 2.5 },
    { phrase: 'unauthorized', weight: 3.0 },
    { phrase: 'revoke', weight: 2.8 },
    { phrase: 'service principal', weight: 2.8 },
    { phrase: 'credentials', weight: 2.8 },
    { phrase: '403', weight: 2.8 },
    { phrase: 'forbidden', weight: 2.8 },
    { phrase: 'access denied', weight: 3.2 },
    { phrase: 'role', weight: 2.2 },
    { phrase: 'token', weight: 2.2 },
    { phrase: 'tokens', weight: 2.2 },
    { phrase: 'compromised', weight: 2.8 },
  ],
  General: [
    { phrase: 'roadmap', weight: 3.2 },
    { phrase: 'documentation', weight: 2.8 },
    { phrase: 'user guides', weight: 3.0 },
    { phrase: 'training', weight: 2.8 },
    { phrase: 'webinar', weight: 3.0 },
    { phrase: 'onboarding', weight: 2.8 },
    { phrase: 'soc 2', weight: 3.0 },
    { phrase: 'iso 27001', weight: 3.0 },
    { phrase: 'gdpr', weight: 2.8 },
    { phrase: 'compliance', weight: 2.2 },
    { phrase: 'operating hours', weight: 3.0 },
    { phrase: 'sla', weight: 2.6 },
    { phrase: 'feature request', weight: 3.2 },
    { phrase: 'feedback', weight: 2.8 },
    { phrase: 'terms of service', weight: 3.0 },
    { phrase: 'privacy policy', weight: 3.0 },
    { phrase: 'data residency', weight: 2.8 },
    { phrase: 'best practices', weight: 2.8 },
    { phrase: 'general question', weight: 3.0 },
    { phrase: 'certification', weight: 2.6 },
    { phrase: 'walkthrough', weight: 2.6 },
  ],
};

export function normalizeText(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Input message must be a string.');
  }
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Input message cannot be empty.');
  }
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(normalizedText: string): string[] {
  return normalizedText
    .split(/[\s/]+/)
    .map((t) => t.replace(/^-+|-+$/g, ''))
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

interface TfIdfModel {
  idf: Map<string, number>;
  centroids: Record<TicketCategory, Map<string, number>>;
}

let cachedTfIdfModel: TfIdfModel | null = null;

function buildTfIdfModelFromDevData(): TfIdfModel {
  if (cachedTfIdfModel) {
    return cachedTfIdfModel;
  }

  const devPathCandidates = [
    path.resolve(process.cwd(), 'sample_data', 'development_tickets.json'),
    path.resolve(process.cwd(), 'backend', 'sample_data', 'development_tickets.json'),
    path.resolve(__dirname, '../../sample_data/development_tickets.json'),
  ];

  let devRecords: DevelopmentRecord[] = [];
  for (const candidate of devPathCandidates) {
    if (fs.existsSync(candidate)) {
      const raw = fs.readFileSync(candidate, 'utf-8');
      devRecords = JSON.parse(raw) as DevelopmentRecord[];
      break;
    }
  }

  const docCount = Math.max(devRecords.length, 1);
  const docFreq = new Map<string, number>();
  const tokenizedDocs: { category: TicketCategory; tokens: string[] }[] = [];

  for (const rec of devRecords) {
    const norm = normalizeText(rec.message);
    const tokens = tokenize(norm);
    tokenizedDocs.push({ category: rec.expectedCategory, tokens });
    const uniqueTokens = new Set(tokens);
    for (const tok of uniqueTokens) {
      docFreq.set(tok, (docFreq.get(tok) || 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [term, df] of docFreq.entries()) {
    // Smoothed IDF formula trained strictly on development corpus
    idf.set(term, Math.log((1 + docCount) / (1 + df)) + 1);
  }

  const centroids: Record<TicketCategory, Map<string, number>> = {
    Billing: new Map(),
    Technical: new Map(),
    Access: new Map(),
    General: new Map(),
  };

  for (const doc of tokenizedDocs) {
    const centroid = centroids[doc.category];
    for (const tok of doc.tokens) {
      const weight = idf.get(tok) || 1;
      centroid.set(tok, (centroid.get(tok) || 0) + weight);
    }
  }

  // L2-normalize each category centroid vector
  for (const category of TICKET_CATEGORIES) {
    const vec = centroids[category];
    let normSq = 0;
    for (const val of vec.values()) {
      normSq += val * val;
    }
    const norm = Math.sqrt(normSq) || 1;
    for (const [k, val] of vec.entries()) {
      vec.set(k, val / norm);
    }
  }

  cachedTfIdfModel = { idf, centroids };
  return cachedTfIdfModel;
}

function computeCosineSimilarity(
  tokens: string[],
  model: TfIdfModel,
  category: TicketCategory
): { similarity: number; topTfIdfTerms: string[] } {
  const queryVec = new Map<string, number>();
  for (const tok of tokens) {
    const idfWeight = model.idf.get(tok);
    if (idfWeight !== undefined) {
      queryVec.set(tok, (queryVec.get(tok) || 0) + idfWeight);
    }
  }

  if (queryVec.size === 0) {
    return { similarity: 0, topTfIdfTerms: [] };
  }

  let queryNormSq = 0;
  for (const val of queryVec.values()) {
    queryNormSq += val * val;
  }
  const queryNorm = Math.sqrt(queryNormSq) || 1;

  const centroid = model.centroids[category];
  let dot = 0;
  const termContributions: { term: string; score: number }[] = [];

  for (const [term, qVal] of queryVec.entries()) {
    const cVal = centroid.get(term) || 0;
    if (cVal > 0) {
      const contrib = (qVal / queryNorm) * cVal;
      dot += contrib;
      termContributions.push({ term, score: contrib });
    }
  }

  termContributions.sort((a, b) => b.score - a.score);
  return {
    similarity: Math.min(1, Math.max(0, dot)),
    topTfIdfTerms: termContributions.slice(0, 4).map((t) => t.term),
  };
}

export function classifyTicketMessage(
  rawMessage: string,
  customThreshold?: number
): ClassificationResult {
  if (typeof rawMessage !== 'string' || rawMessage.trim().length === 0) {
    throw new Error('Cannot classify an empty or invalid ticket message.');
  }

  const threshold =
    customThreshold !== undefined ? customThreshold : getConfig().confidenceThreshold;

  const normalized = normalizeText(rawMessage);
  const tokens = tokenize(normalized);
  const model = buildTfIdfModelFromDevData();

  const lexiconScores: Record<TicketCategory, number> = {
    Billing: 0,
    Technical: 0,
    Access: 0,
    General: 0,
  };

  const matchedPhrasesByCategory: Record<TicketCategory, string[]> = {
    Billing: [],
    Technical: [],
    Access: [],
    General: [],
  };

  const tokenSet = new Set(tokens);

  for (const category of TICKET_CATEGORIES) {
    for (const rule of DOMAIN_LEXICON[category]) {
      const ruleWords = rule.phrase.split(' ');
      let matched = false;
      if (ruleWords.length === 1) {
        matched =
          tokenSet.has(rule.phrase) ||
          tokens.some((t) => t.startsWith(rule.phrase) && rule.phrase.length >= 4);
      } else {
        matched = normalized.includes(rule.phrase);
      }
      if (matched) {
        lexiconScores[category] += rule.weight;
        matchedPhrasesByCategory[category].push(rule.phrase);
      }
    }
  }

  const combinedScores: Record<TicketCategory, number> = {
    Billing: 0,
    Technical: 0,
    Access: 0,
    General: 0,
  };

  const tfIdfMatchesByCategory: Record<TicketCategory, string[]> = {
    Billing: [],
    Technical: [],
    Access: [],
    General: [],
  };

  for (const category of TICKET_CATEGORIES) {
    const { similarity, topTfIdfTerms } = computeCosineSimilarity(tokens, model, category);
    tfIdfMatchesByCategory[category] = topTfIdfTerms;
    // Hybrid score: weighted domain lexicon + dev-set TF-IDF centroid similarity (scaled by 6.0)
    combinedScores[category] = Number((lexiconScores[category] + similarity * 6.0).toFixed(4));
  }

  // Deterministic tie-breaking order: Technical > Access > Billing > General
  const priorityOrder: TicketCategory[] = ['Technical', 'Access', 'Billing', 'General'];
  const sortedCategories = [... priorityOrder].sort(
    (a, b) => combinedScores[b] - combinedScores[a]
  );

  const topCategory = sortedCategories[0];
  const secondCategory = sortedCategories[1];
  const topScore = combinedScores[topCategory];
  const secondScore = combinedScores[secondCategory];
  const totalScore = Object.values(combinedScores).reduce((sum, val) => sum + val, 0);

  // If no category has any meaningful signal, fallback to General with low confidence
  if (topScore < 0.8 || tokens.length < 2) {
    return {
      category: 'General',
      confidence: 0.2,
      isUncertain: true,
      uncertaintyReason:
        'Insufficient domain-specific signals detected in message; routed to human review.',
      explanation:
        'No strong domain keywords or TF-IDF features matched across Billing, Technical, Access, or General categories. Defaulted to General with mandatory human review.',
      matchedSignals: [],
      categoryScores: combinedScores,
    };
  }

  // Confidence proxy formula:
  // Combines signal strength (saturation curve on topScore) and separation margin over runner-up
  const strengthFactor = Math.min(1, topScore / 7.5);
  const dominanceRatio = totalScore > 0 ? topScore / totalScore : 0.25;
  const marginRatio = topScore > 0 ? (topScore - secondScore) / topScore : 0;

  const rawConfidence = 0.45 * strengthFactor + 0.30 * dominanceRatio + 0.25 * marginRatio;
  const confidence = Number(Math.min(0.98, Math.max(0.15, rawConfidence)).toFixed(2));

  // Detect conflicting multi-category ambiguity even if raw strength is moderate
  const hasCompetingCategory =
    secondScore >= 2.8 && marginRatio < 0.25;
  const isBelowThreshold = confidence < threshold;
  const isUncertain = isBelowThreshold || hasCompetingCategory;

  let uncertaintyReason: string | null = null;
  if (hasCompetingCategory) {
    uncertaintyReason = `Competing signals detected between ${topCategory} (score ${topScore.toFixed(
      2
    )}) and ${secondCategory} (score ${secondScore.toFixed(2)}); requires human triage.`;
  } else if (isBelowThreshold) {
    uncertaintyReason = `Classification confidence proxy (${confidence.toFixed(
      2
    )}) is below configured threshold (${threshold.toFixed(2)}).`;
  }

  const matchedSignals = Array.from(
    new Set([
      ...matchedPhrasesByCategory[topCategory],
      ...tfIdfMatchesByCategory[topCategory],
    ])
  ).slice(0, 6);

  const signalSummary =
    matchedSignals.length > 0
      ? `Matched signals: ${matchedSignals.join(', ')}.`
      : 'Classified via TF-IDF similarity against development set.';

  const explanation = isUncertain
    ? `${signalSummary} Best candidate: ${topCategory} (confidence proxy ${confidence.toFixed(
        2
      )}). Flagged for manual review: ${uncertaintyReason}`
    : `${signalSummary} High-margin match for ${topCategory} category (confidence proxy ${confidence.toFixed(
        2
      )}, runner-up ${secondCategory} score ${secondScore.toFixed(2)}).`;

  return {
    category: topCategory,
    confidence,
    isUncertain,
    uncertaintyReason,
    explanation,
    matchedSignals,
    categoryScores: combinedScores,
  };
}
