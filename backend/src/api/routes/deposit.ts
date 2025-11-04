import { Router } from 'express';
import { authenticateRequest } from '../middlewares/auth';
import { depositController } from '../controllers/deposit.controller';

const router = Router();

// Все роуты требуют аутентификации
router.use(authenticateRequest);

/**
 * @route POST /api/deposit/get
 * @desc Получает депозитный адрес с уникальным комментарием для транзакции
 * @access Private
 * @body { amount: string }
 */
router.post('/get', depositController.getDepositAddress);

/**
 * @route POST /api/deposit/stars
 * @desc Создает Stars invoice для пополнения баланса
 * @access Private
 * @body { amount: number }
 */
router.post('/stars', depositController.createStarsInvoice);

export default router;
