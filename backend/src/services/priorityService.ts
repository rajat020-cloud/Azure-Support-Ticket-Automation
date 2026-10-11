import { SlaTarget, TicketCategory, TicketPriority } from '../models/Ticket';
import { normalizeText } from './classifierService';

export interface PriorityEvaluationResult {
  priority: TicketPriority;
  prioritySignals: string[];
  priorityExplanation: string;
  slaTarget: SlaTarget;
}

export const PRIORITY_SLA_MAP: Record<TicketPriority, SlaTarget> = {
  Critical: {
    firstResponseMinutes: 15,
    resolutionHours: 2,
    label: '15m response / 2h resolution SLA',
  },
  High: {
    firstResponseMinutes: 60,
    resolutionHours: 4,
    label: '1h response / 4h resolution SLA',
  },
  Medium: {
    firstResponseMinutes: 240,
    resolutionHours: 24,
    label: '4h response / 24h resolution SLA',
  },
  Low: {
    firstResponseMinutes: 1440,
    resolutionHours: 72,
    label: '24h response / 72h resolution SLA',
  },
};

function extractAffectedUserCount(normalizedText: string): number {
  const regex = /(\d[\d,]*)\+?\s*(?:enterprise\s+|active\s+)?(?:users|customers|employees|analysts|engineers|seats)/i;
  const match = normalizedText.match(regex);
  if (!match) return 0;
  const parsed = parseInt(match[1].replace(/,/g, ''), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function determineTicketPriority(
  rawMessage: string,
  predictedCategory: TicketCategory
): PriorityEvaluationResult {
  const normalized = normalizeText(rawMessage);
  const signals: string[] = [];

  const affectedUsers = extractAffectedUserCount(normalized);
  if (affectedUsers > 0) {
    signals.push(`affected_users:${affectedUsers}`);
  }

  // 1. Check for corroborated Critical criteria:
  // Criterion A: Widespread production outage or multi-user authentication outage
  const hasOutageSignal =
    /\b(outage|kernel panic|502 bad gateway|http 500|all regional endpoints)\b/.test(normalized) ||
    (/\b(sso|saml|federation)\b/.test(normalized) && /\b(failing|locked out)\b/.test(normalized));

  const hasWidespreadScope =
    affectedUsers >= 50 ||
    /\b(all \d+|entire .* team|widespread|complete .* outage|all regional endpoints)\b/.test(
      normalized
    );

  // Criterion B: Active security compromise / unauthorized access incident
  const hasSecurityIncident =
    /\b(unauthorized|compromised|security breach)\b/.test(normalized) &&
    /\b(revoke|lock|credentials|service principal|login|tokens)\b/.test(normalized);

  if (hasOutageSignal && hasWidespreadScope) {
    signals.push('widespread_service_disruption', 'production_outage');
    return {
      priority: 'Critical',
      prioritySignals: signals,
      priorityExplanation:
        'Critical priority assigned due to corroborated widespread service disruption affecting a large user base or entire organization.',
      slaTarget: PRIORITY_SLA_MAP.Critical,
    };
  }

  if (hasSecurityIncident) {
    signals.push('security_compromise', 'urgent_credential_revocation');
    return {
      priority: 'Critical',
      prioritySignals: signals,
      priorityExplanation:
        'Critical priority assigned due to reported unauthorized access or compromised credentials requiring immediate containment.',
      slaTarget: PRIORITY_SLA_MAP.Critical,
    };
  }

  // 2. Check for High priority criteria:
  // Criterion A: Explicit near-term deadline or imminent account suspension/termination
  const hasImminentDeadline =
    /\b(tomorrow|in 24 hours|within 24 hours|suspended|terminated|deadline)\b/.test(normalized);

  // Criterion B: Severe technical degradation (crashes, memory exhaustion, severe DB latency)
  const hasSevereTechDegradation =
    /\b(crashing|crashes|outofmemory|memory leak|high cpu|connection pool exhaustion|latency spiked)\b/.test(
      normalized
    );

  // Criterion C: Active user lockout preventing account sign-in
  const hasAccountLockout =
    /\b(cannot log into|cannot access my account|unable to reset password|locked out of my account)\b/.test(
      normalized
    ) ||
    (/\b(password)\b/.test(normalized) &&
      /\b(rejected|expired|cannot|unable)\b/.test(normalized));

  if (hasImminentDeadline) {
    signals.push('imminent_deadline_or_suspension');
  }
  if (hasSevereTechDegradation) {
    signals.push('severe_technical_degradation');
  }
  if (hasAccountLockout) {
    signals.push('active_account_lockout');
  }

  if (hasImminentDeadline || hasSevereTechDegradation || hasAccountLockout) {
    return {
      priority: 'High',
      prioritySignals: signals,
      priorityExplanation:
        'High priority assigned due to active account lockout, severe service degradation, or an explicit near-term deadline/suspension risk.',
      slaTarget: PRIORITY_SLA_MAP.High,
    };
  }

  // 3. Check for Medium priority criteria:
  // Criterion A: Financial discrepancy, duplicate charge, overage, or billing dispute
  const hasBillingDiscrepancy =
    /\b(charged twice|duplicate charge|overage|jump by|still includes|dispute|refund)\b/.test(
      normalized
    );

  // Criterion B: Isolated or staging technical error / timeout / permission error
  const hasModerateTechOrAccessIssue =
    /\b(timeout|504|403|forbidden|access denied|webhook|tls|cron|stopped executing|lost .* device|reset my 2fa)\b/.test(
      normalized
    );

  // Criterion C: Compliance audit documentation request
  const hasComplianceAuditRequest =
    /\b(compliance audit|soc 2|gdpr)\b/.test(normalized);

  if (hasBillingDiscrepancy) {
    signals.push('billing_discrepancy_or_overage');
  }
  if (hasModerateTechOrAccessIssue) {
    signals.push('isolated_functional_or_access_issue');
  }
  if (hasComplianceAuditRequest) {
    signals.push('compliance_audit_documentation');
  }

  if (hasBillingDiscrepancy || hasModerateTechOrAccessIssue || hasComplianceAuditRequest) {
    return {
      priority: 'Medium',
      prioritySignals: signals,
      priorityExplanation:
        'Medium priority assigned due to an isolated technical/access failure, billing discrepancy, or compliance audit requirement without widespread outage.',
      slaTarget: PRIORITY_SLA_MAP.Medium,
    };
  }

  // 4. Default to Low priority for routine requests, documentation, RBAC provisioning, receipts, UI bugs
  signals.push(`routine_${predictedCategory.toLowerCase()}_request`);
  return {
    priority: 'Low',
    prioritySignals: signals,
    priorityExplanation:
      'Low priority assigned for a routine administrative request, documentation inquiry, standard role assignment, or minor non-blocking issue.',
    slaTarget: PRIORITY_SLA_MAP.Low,
  };
}
