import { z } from 'zod';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  REVIEW_STATUSES,
} from '../models/Ticket';

export const createTicketSchema = z.object({
  ticketId: z
    .string({
      required_error: 'ticketId is required.',
      invalid_type_error: 'ticketId must be a string.',
    })
    .trim()
    .min(3, 'ticketId must be at least 3 characters long.')
    .max(40, 'ticketId must not exceed 40 characters.')
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
      'ticketId may only contain letters, numbers, hyphens, and underscores.'
    ),
  message: z
    .string({
      required_error: 'Customer message is required.',
      invalid_type_error: 'Customer message must be a string.',
    })
    .trim()
    .min(5, 'Customer message must be at least 5 characters long.')
    .max(5000, 'Customer message must not exceed 5000 characters.'),
});

export const analyzeTicketSchema = z.object({
  ticketId: z.string().trim().max(40).optional().default('PREVIEW-001'),
  message: z
    .string({
      required_error: 'Customer message is required for analysis.',
      invalid_type_error: 'Customer message must be a string.',
    })
    .trim()
    .min(5, 'Customer message must be at least 5 characters long.')
    .max(5000, 'Customer message must not exceed 5000 characters.'),
});

export const listTicketsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? 1 : Number(val)))
    .refine((val) => Number.isInteger(val) && val >= 1, {
      message: 'page must be a positive integer.',
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? 10 : Number(val)))
    .refine((val) => Number.isInteger(val) && val >= 1 && val <= 100, {
      message: 'limit must be an integer between 1 and 100.',
    }),
  search: z.string().trim().max(200).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  reviewStatus: z.enum(REVIEW_STATUSES).optional(),
  sortBy: z.enum(['createdAt', 'ticketId', 'priority', 'confidence']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const approveTicketSchema = z.object({
  approved: z
    .boolean({
      required_error: 'Explicit approval confirmation (approved: true) is required.',
      invalid_type_error: 'approved must be a boolean value.',
    })
    .refine((val) => val === true, {
      message: 'Explicit approval confirmation must be set to true.',
    }),
  reviewerId: z
    .string()
    .trim()
    .min(2, 'reviewerId must be at least 2 characters.')
    .max(100, 'reviewerId must not exceed 100 characters.')
    .optional()
    .default('authorized-reviewer'),
  reviewerNotes: z.string().trim().max(1000).optional(),
});

export const triageTicketSchema = z.object({
  category: z.enum(TICKET_CATEGORIES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  summary: z.string().trim().min(5, 'Summary must be at least 5 characters.').max(1000).optional(),
  draftResponse: z
    .string()
    .trim()
    .min(10, 'Draft response must be at least 10 characters.')
    .max(5000)
    .optional(),
  resolveUncertainty: z.boolean().optional().default(true),
  reviewerNotes: z.string().trim().max(1000).optional(),
});

export const registerUserSchema = z.object({
  name: z
    .string({ required_error: 'Full name is required.' })
    .trim()
    .min(2, 'Name must be at least 2 characters long.')
    .max(80, 'Name must not exceed 80 characters.'),
  email: z
    .string({ required_error: 'Email address is required.' })
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address.'),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(6, 'Password must be at least 6 characters long.')
    .max(128, 'Password must not exceed 128 characters.'),
});

export const loginUserSchema = z.object({
  email: z
    .string({ required_error: 'Email address is required.' })
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address.'),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(1, 'Password is required.'),
});
