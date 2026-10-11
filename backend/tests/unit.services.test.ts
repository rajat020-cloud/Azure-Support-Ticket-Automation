import { describe, it, expect } from 'vitest';
import { classifyTicketMessage, normalizeText } from '../src/services/classifierService';
import { determineTicketPriority } from '../src/services/priorityService';
import { routeTicket } from '../src/services/routingService';
import { generateSummaryAndDraft } from '../src/services/draftService';
import { evaluateHeldOutDataset } from '../src/services/evaluationService';

describe('Unit Tests — Classifier, Priority Policy, Routing, Drafts, and Evaluation', () => {
  describe('1. Text Normalization & Input Validation', () => {
    it('normalizes casing, punctuation, and whitespace deterministically', () => {
      const normalized = normalizeText('  URGENT!! Invoice #INV-88421 Charged Twice?? ');
      expect(normalized).toBe('urgent invoice inv-88421 charged twice');
    });

    it('throws an explicit error when classifying empty or whitespace-only text', () => {
      expect(() => classifyTicketMessage('')).toThrow();
      expect(() => classifyTicketMessage('    ')).toThrow();
    });
  });

  describe('2. Representative Category Predictions & Determinism', () => {
    it('correctly classifies Billing tickets and identifies matched signals', () => {
      const result = classifyTicketMessage(
        'We were charged twice on our monthly subscription invoice and need a billing refund.'
      );
      expect(result.category).toBe('Billing');
      expect(result.isUncertain).toBe(false);
      expect(result.confidence).toBeGreaterThanOrEqual(0.45);
      expect(result.matchedSignals).toContain('invoice');
    });

    it('correctly classifies Technical tickets and identifies matched signals', () => {
      const result = classifyTicketMessage(
        'Our Node.js API endpoint is crashing with HTTP 502 Bad Gateway and memory leak errors.'
      );
      expect(result.category).toBe('Technical');
      expect(result.isUncertain).toBe(false);
      expect(result.confidence).toBeGreaterThanOrEqual(0.45);
    });

    it('correctly classifies Access tickets and identifies matched signals', () => {
      const result = classifyTicketMessage(
        'I cannot log into my account after resetting my password because MFA token is rejected.'
      );
      expect(result.category).toBe('Access');
      expect(result.isUncertain).toBe(false);
      expect(result.confidence).toBeGreaterThanOrEqual(0.45);
    });

    it('correctly classifies General tickets and identifies matched signals', () => {
      const result = classifyTicketMessage(
        'Could you share your product roadmap, user guides, and upcoming onboarding webinar schedule?'
      );
      expect(result.category).toBe('General');
      expect(result.isUncertain).toBe(false);
      expect(result.confidence).toBeGreaterThanOrEqual(0.45);
    });

    it('returns identical deterministic outputs for repeated identical inputs', () => {
      const input = 'Please update VAT registration on our monthly billing receipt.';
      const first = classifyTicketMessage(input);
      const second = classifyTicketMessage(input);
      expect(first).toEqual(second);
    });
  });

  describe('3. Ambiguous & Uncertain Ticket Detection', () => {
    it('flags vague messages with no domain signals as uncertain for manual review', () => {
      const result = classifyTicketMessage(
        'Need help urgently with our portal, something is wrong and we cannot proceed.'
      );
      expect(result.isUncertain).toBe(true);
      expect(result.explanation).toMatch(/human review|manual review/i);
    });

    it('flags cross-category competing signals with narrow margin as uncertain', () => {
      const result = classifyTicketMessage(
        'I cannot log into the billing portal to download my invoice because the page crashes with a 500 error.'
      );
      expect(result.isUncertain).toBe(true);
      expect(result.uncertaintyReason).toBeTruthy();
    });
  });

  describe('4. Priority Policy Correctness & Context Sensitivity', () => {
    it('assigns Critical priority only when widespread outage or security compromise is corroborated', () => {
      const outage = determineTicketPriority(
        'Complete production outage! Primary cluster crashed with HTTP 500 errors affecting all 1,200 active users.',
        'Technical'
      );
      expect(outage.priority).toBe('Critical');

      const security = determineTicketPriority(
        'Security breach alert: detected compromised API credentials and unauthorized login attempts. Revoke tokens immediately!',
        'Access'
      );
      expect(security.priority).toBe('Critical');
    });

    it('does NOT assign Critical priority merely because an alarming keyword is used on a routine request', () => {
      const routineWithAlarmWord = determineTicketPriority(
        'URGENT CRITICAL question: where can I download the user guides and product roadmap documentation?',
        'General'
      );
      expect(routineWithAlarmWord.priority).toBe('Low');
    });

    it('assigns High priority for individual account lockouts or imminent suspension deadlines', () => {
      const lockout = determineTicketPriority(
        'I cannot access my account after resetting my password.',
        'Access'
      );
      expect(lockout.priority).toBe('High');

      const deadline = determineTicketPriority(
        'Our credit card expired and our subscription will be suspended tomorrow unless updated.',
        'Billing'
      );
      expect(deadline.priority).toBe('High');
    });

    it('assigns Medium priority for billing discrepancies and isolated technical errors', () => {
      const billingDispute = determineTicketPriority(
        'We were charged twice on our monthly invoice INV-102 for $300.',
        'Billing'
      );
      expect(billingDispute.priority).toBe('Medium');
    });
  });

  describe('5. Team Assignment & Routing Policy', () => {
    it('maps all four categories to their designated support teams and sets reviewStatus appropriately', () => {
      expect(routeTicket('Billing', 'Medium', false)).toEqual(
        expect.objectContaining({
          assignedTeam: 'Billing Support',
          reviewStatus: 'pending_review',
        })
      );
      expect(routeTicket('Technical', 'Critical', false)).toEqual(
        expect.objectContaining({
          assignedTeam: 'Technical Support',
          reviewStatus: 'pending_review',
        })
      );
      expect(routeTicket('Access', 'High', false)).toEqual(
        expect.objectContaining({
          assignedTeam: 'Identity and Access Support',
          reviewStatus: 'pending_review',
        })
      );
      expect(routeTicket('General', 'Low', true)).toEqual(
        expect.objectContaining({
          assignedTeam: 'General Support',
          reviewStatus: 'needs_review',
        })
      );
    });
  });

  describe('6. Summary & Safe Draft Response Generation', () => {
    it('generates contextual drafts without promising refunds or claiming resolution', () => {
      const res = generateSummaryAndDraft({
        ticketId: 'TCK-9001',
        message: 'We were charged twice on invoice INV-500 and want a refund.',
        category: 'Billing',
        priority: 'Medium',
        assignedTeam: 'Billing Support',
        isUncertain: false,
        matchedSignals: ['charged', 'invoice', 'refund'],
      });

      expect(res.summary).toContain('Billing');
      expect(res.draftResponse).toContain('TCK-9001');
      expect(res.draftResponse).toContain('DRAFT — AWAITING HUMAN REVIEW');
      expect(res.draftResponse).toContain('no account, billing, or infrastructure changes have been executed yet');
    });
  });

  describe('7. Held-Out Dataset Evaluation Calculation', () => {
    it('evaluates the held-out dataset of at least 10 tickets across all 4 categories', () => {
      const report = evaluateHeldOutDataset(true);
      expect(report.totalTestTickets).toBeGreaterThanOrEqual(10);
      expect(report.perCategoryMetrics).toHaveLength(4);
      expect(report.overallCategoryAccuracy).toBeGreaterThanOrEqual(0.75);
      expect(report.confusionMatrix.Billing.Billing).toBeGreaterThan(0);
      expect(report.confusionMatrix.Technical.Technical).toBeGreaterThan(0);
      expect(report.confusionMatrix.Access.Access).toBeGreaterThan(0);
      expect(report.confusionMatrix.General.General).toBeGreaterThan(0);
    });
  });
});
