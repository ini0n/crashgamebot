import { Router } from 'express';
import { authenticateRequest } from '../middlewares/auth';
import { referralsController } from '../controllers/referrals.controller';

const router = Router();

/**
 * GET /api/referrals
 * Получить список рефералов пользователя с пагинацией
 */
router.get('/', authenticateRequest, referralsController.getReferrals);

export default router;
