import { AssignedTeam, TicketCategory, TicketPriority } from '../models/Ticket';

export interface SummaryAndDraftResult {
  summary: string;
  draftResponse: string;
}

function extractCoreSnippet(rawMessage: string): string {
  const cleaned = rawMessage.replace(/\s+/g, ' ').trim();
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const primarySentence = sentences[0] || cleaned;
  if (primarySentence.length <= 150) {
    return primarySentence.replace(/[.!?]+$/, '');
  }
  return `${primarySentence.slice(0, 147).trim()}...`;
}

export function generateSummaryAndDraft(params: {
  ticketId: string;
  message: string;
  category: TicketCategory;
  priority: TicketPriority;
  assignedTeam: AssignedTeam;
  isUncertain: boolean;
  matchedSignals: string[];
}): SummaryAndDraftResult {
  const { ticketId, message, category, priority, assignedTeam, isUncertain, matchedSignals } =
    params;

  const coreSnippet = extractCoreSnippet(message);
  const signalContext =
    matchedSignals.length > 0
      ? ` Key indicators: ${matchedSignals.slice(0, 3).join(', ')}.`
      : '';

  if (isUncertain) {
    const summary = `[Manual Triage Required] Customer submitted a request (${ticketId}) with ambiguous or limited category indicators: "${coreSnippet}". Provisional category: ${category} (${priority} priority).`;

    const draftResponse = [
      `[DRAFT — REQUIRES HUMAN TRIAGE & EDITING BEFORE SENDING]`,
      `Hello,`,
      ``,
      `Thank you for contacting Azure Support regarding Ticket ${ticketId} ("${coreSnippet}").`,
      ``,
      `We have logged your request and routed it for manual specialist review so we can ensure the right support team addresses your concern accurately. To help us assist you faster, could you please reply with any additional details, such as the affected Azure resource or subscription ID, any exact error messages, or screenshots?`,
      ``,
      `Best regards,`,
      `Azure Support Operations (Provisional Queue: ${assignedTeam})`,
    ].join('\n');

    return { summary, draftResponse };
  }

  const summary = `[${category} | ${priority}] Customer reported: "${coreSnippet}". Assigned to ${assignedTeam}.${signalContext}`;

  const priorityNote =
    priority === 'Critical' || priority === 'High'
      ? `Because this request has been prioritized as ${priority}, it has been flagged for expedited review within the ${assignedTeam} queue.`
      : `Your ticket has been queued with ${assignedTeam} (${priority} priority).`;

  const categoryGuidance: Record<TicketCategory, string> = {
    Billing:
      'A Billing Support specialist will review your account statement, invoice details, and subscription billing records to verify the charges and advise on next steps.',
    Technical:
      'A Technical Support engineer will investigate the reported technical behavior, inspect relevant service telemetry or error codes, and follow up with diagnostic findings.',
    Access:
      'An Identity and Access Support specialist will review the authentication, permission, or directory configuration details while adhering to our security verification policies.',
    General:
      'A General Support representative will gather the requested documentation, policy details, or scheduling information and share it with you shortly.',
  };

  const draftResponse = [
    `[DRAFT — AWAITING HUMAN REVIEW & APPROVAL]`,
    `Hello,`,
    ``,
    `Thank you for reaching out to Azure Support regarding Ticket ${ticketId} ("${coreSnippet}").`,
    ``,
    `${priorityNote} ${categoryGuidance[category]}`,
    ``,
    `Please note that this is an initial acknowledgment and no account, billing, or infrastructure changes have been executed yet. If you have additional logs, correlation IDs, or context to add in the meantime, please reply referencing Ticket ${ticketId}.`,
    ``,
    `Best regards,`,
    `${assignedTeam}`,
  ].join('\n');

  return { summary, draftResponse };
}
