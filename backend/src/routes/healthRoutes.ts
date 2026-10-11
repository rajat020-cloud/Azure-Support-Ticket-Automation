import { Router } from 'express';
import { getHealthStatus } from '../controllers/healthController';

const router = Router();

router.get('/health', getHealthStatus);

export default router;
