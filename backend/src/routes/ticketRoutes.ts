import { Router } from 'express';
import {
  analyzeTicketPreview,
  approveTicketDraft,
  createTicket,
  getDashboardMetrics,
  getEvaluationMetrics,
  getTicketById,
  listTickets,
  triageTicket,
} from '../controllers/ticketController';
import { requireReviewerAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/metrics', getDashboardMetrics);
router.get('/evaluation', getEvaluationMetrics);
router.post('/analyze', analyzeTicketPreview);
router.post('/tickets', createTicket);
router.get('/tickets', listTickets);
router.get('/tickets/:ticketId', getTicketById);
router.patch('/tickets/:ticketId/triage', requireReviewerAuth, triageTicket);
router.post('/tickets/:ticketId/approve', requireReviewerAuth, approveTicketDraft);

export default router;
