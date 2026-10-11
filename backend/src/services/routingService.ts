import {
  AssignedTeam,
  ReviewStatus,
  TicketCategory,
  TicketPriority,
} from '../models/Ticket';

export interface RoutingResult {
  assignedTeam: AssignedTeam;
  reviewStatus: ReviewStatus;
  routingNotes: string;
}

const CATEGORY_TEAM_MAP: Record<TicketCategory, AssignedTeam> = {
  Billing: 'Billing Support',
  Technical: 'Technical Support',
  Access: 'Identity and Access Support',
  General: 'General Support',
};

export function routeTicket(
  category: TicketCategory,
  priority: TicketPriority,
  isUncertain: boolean
): RoutingResult {
  const assignedTeam = CATEGORY_TEAM_MAP[category];

  if (isUncertain) {
    return {
      assignedTeam,
      reviewStatus: 'needs_review',
      routingNotes: `Provisionally routed to ${assignedTeam} with mandatory manual triage required due to classification uncertainty.`,
    };
  }

  const escalationSuffix =
    priority === 'Critical' || priority === 'High'
      ? ` Escalated within ${assignedTeam} queue for ${priority} priority handling.`
      : '';

  return {
    assignedTeam,
    reviewStatus: 'pending_review',
    routingNotes: `Routed to ${assignedTeam} based on ${category} classification.${escalationSuffix}`,
  };
}
