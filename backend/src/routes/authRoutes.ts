import { Router } from 'express';
import {
  getCurrentUser,
  loginUser,
  registerUser,
} from '../controllers/authController';

const router = Router();

router.post('/auth/register', registerUser);
router.post('/auth/login', loginUser);
router.get('/auth/me', getCurrentUser);

export default router;
