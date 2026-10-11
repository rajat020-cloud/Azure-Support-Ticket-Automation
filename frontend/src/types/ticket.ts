export type TicketCategory = 'Billing' | 'Technical' | 'Access' | 'General';
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type AssignedTeam =
  | 'Billing Support'
  | 'Technical Support'
  | 'Identity and Access Support'
  | 'General Support';
export type ReviewStatus = 'pending_review' | 'needs_review' | 'approved';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'reviewer' | 'admin';
}

export interface AuthResponse {
  message: string;
  token: string;
  user: AuthUser;
}

export interface ApprovalMetadata {
  approvedBy: string | null;
  approvedAt: string | null;
  reviewerNotes?: string | null;
}

export interface AuditLogEntry {
  action: 'created' | 'triaged' | 'approved';
  actor: string;
  timestamp: string;
  details: string;
}

export interface SlaTarget {
  firstResponseMinutes: number;
  resolutionHours: number;
  label: string;
}

export interface Ticket {
  _id?: string;
  ticketId: string;
  message: string;
  category: TicketCategory;
  priority: TicketPriority;
  assignedTeam: AssignedTeam;
  summary: string;
  draftResponse: string;
  confidence: number;
  classificationExplanation: string;
  matchedSignals: string[];
  prioritySignals: string[];
  categoryScores?: Record<TicketCategory, number>;
  slaTarget?: SlaTarget;
  isUncertain: boolean;
  reviewStatus: ReviewStatus;
  approvalMetadata: ApprovalMetadata;
  auditLog?: AuditLogEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketAnalysisPreview {
  category: TicketCategory;
  priority: TicketPriority;
  assignedTeam: AssignedTeam;
  reviewStatus: ReviewStatus;
  confidence: number;
  confidenceThreshold: number;
  isUncertain: boolean;
  uncertaintyReason: string | null;
  classificationExplanation: string;
  matchedSignals: string[];
  prioritySignals: string[];
  categoryScores: Record<TicketCategory, number>;
  slaTarget: SlaTarget;
  summary: string;
  draftResponse: string;
}

export interface PaginationMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface TicketListResponse {
  tickets: Ticket[];
  pagination: PaginationMetadata;
}

export interface DashboardMetricsResponse {
  totalTickets: number;
  byCategory: Record<TicketCategory, number>;
  byPriority: Record<TicketPriority, number>;
  byReviewStatus: Record<ReviewStatus, number>;
  criticalAndHighCount?: number;
  approvalRate?: number;
  recentTickets: Ticket[];
}

export interface CategoryMetric {
  category: TicketCategory;
  totalExpected: number;
  totalPredicted: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
  categoryAccuracy: number;
}

export interface PredictionRecord {
  ticketId: string;
  predictedCategory: TicketCategory;
  expectedCategory?: TicketCategory;
  categoryCorrect: boolean;
  predictedPriority: TicketPriority;
  expectedPriority?: TicketPriority;
  priorityCorrect: boolean;
  predictedTeam: AssignedTeam;
  confidence: number;
  isUncertain: boolean;
}

export interface EvaluationReport {
  datasetName: string;
  evaluatedAt: string;
  totalTestTickets: number;
  correctCategoryPredictions: number;
  overallCategoryAccuracy: number;
  correctPriorityPredictions: number;
  overallPriorityAccuracy: number;
  correctTeamAssignments: number;
  overallTeamAccuracy: number;
  perCategoryMetrics: CategoryMetric[];
  confusionMatrix: Record<TicketCategory, Record<TicketCategory, number>>;
  predictions?: PredictionRecord[];
}

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  service: string;
  database: {
    connected: boolean;
    state: string;
  };
  timestamp: string;
}
