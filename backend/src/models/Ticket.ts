import mongoose, { Schema, Document } from 'mongoose';

export const TICKET_CATEGORIES = ['Billing', 'Technical', 'Access', 'General'] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const ASSIGNED_TEAMS = [
  'Billing Support',
  'Technical Support',
  'Identity and Access Support',
  'General Support',
] as const;
export type AssignedTeam = (typeof ASSIGNED_TEAMS)[number];

export const REVIEW_STATUSES = ['pending_review', 'needs_review', 'approved'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export interface ApprovalMetadata {
  approvedBy: string | null;
  approvedAt: Date | null;
  reviewerNotes?: string | null;
}

export interface AuditLogEntry {
  action: 'created' | 'triaged' | 'approved';
  actor: string;
  timestamp: Date;
  details: string;
}

export interface SlaTarget {
  firstResponseMinutes: number;
  resolutionHours: number;
  label: string;
}

export interface ITicket {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface ITicketDocument extends ITicket, Document {}

const ApprovalMetadataSchema = new Schema<ApprovalMetadata>(
  {
    approvedBy: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    reviewerNotes: { type: String, default: null },
  },
  { _id: false }
);

const AuditLogEntrySchema = new Schema<AuditLogEntry>(
  {
    action: {
      type: String,
      enum: ['created', 'triaged', 'approved'],
      required: true,
    },
    actor: { type: String, required: true },
    timestamp: { type: Date, required: true, default: () => new Date() },
    details: { type: String, required: true },
  },
  { _id: false }
);

const SlaTargetSchema = new Schema<SlaTarget>(
  {
    firstResponseMinutes: { type: Number, required: true },
    resolutionHours: { type: Number, required: true },
    label: { type: String, required: true },
  },
  { _id: false }
);

const TicketSchema = new Schema<ITicketDocument>(
  {
    ticketId: {
      type: String,
      required: [true, 'ticketId is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Customer message is required'],
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: TICKET_CATEGORIES,
    },
    priority: {
      type: String,
      required: true,
      enum: TICKET_PRIORITIES,
    },
    assignedTeam: {
      type: String,
      required: true,
      enum: ASSIGNED_TEAMS,
    },
    summary: {
      type: String,
      required: true,
    },
    draftResponse: {
      type: String,
      required: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    classificationExplanation: {
      type: String,
      required: true,
    },
    matchedSignals: {
      type: [String],
      default: [],
    },
    prioritySignals: {
      type: [String],
      default: [],
    },
    categoryScores: {
      type: Schema.Types.Mixed,
      default: () => ({ Billing: 0, Technical: 0, Access: 0, General: 0 }),
    },
    slaTarget: {
      type: SlaTargetSchema,
      default: () => ({
        firstResponseMinutes: 240,
        resolutionHours: 24,
        label: '4h response / 24h target',
      }),
    },
    isUncertain: {
      type: Boolean,
      required: true,
      default: false,
    },
    reviewStatus: {
      type: String,
      required: true,
      enum: REVIEW_STATUSES,
      default: 'pending_review',
    },
    approvalMetadata: {
      type: ApprovalMetadataSchema,
      default: () => ({
        approvedBy: null,
        approvedAt: null,
        reviewerNotes: null,
      }),
    },
    auditLog: {
      type: [AuditLogEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Explicit unique index on ticketId to prevent duplicate records even under concurrency
TicketSchema.index({ ticketId: 1 }, { unique: true });
TicketSchema.index({ category: 1, priority: 1, reviewStatus: 1, createdAt: -1 });

export const TicketModel: mongoose.Model<ITicketDocument> =
  (mongoose.models.Ticket as mongoose.Model<ITicketDocument>) ||
  mongoose.model<ITicketDocument>('Ticket', TicketSchema);
