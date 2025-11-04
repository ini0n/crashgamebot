import { Router } from 'express';
import { connectWallet, disconnectWallet, getWalletStatus, getBalance, getTransactions } from '../controllers/wallet.controller';
import { authenticateRequest } from '../middlewares/auth';

const router = Router();

// Все роуты требуют аутентификации
router.use(authenticateRequest);

/**
 * @route POST /api/wallet/connect
 * @desc Подключить TON кошелек к пользователю
 * @access Private
 * @body { walletAddress: string }
 */
router.post('/connect', connectWallet);

/**
 * @route POST /api/wallet/disconnect  
 * @desc Отключить TON кошелек от пользователя
 * @access Private
 */
router.post('/disconnect', disconnectWallet);

/**
 * @route GET /api/wallet/status
 * @desc Получить статус подключения кошелька
 * @access Private
 */
router.get('/status', getWalletStatus);

/**
 * @route GET /api/wallet/balance
 * @desc Получить баланс пользователя (TON, Stars, Gifts)
 * @access Private
 */
router.get('/balance', getBalance);

/**
 * @route GET /api/wallet/transactions
 * @desc Получить историю транзакций пользователя
 * @access Private
 * @query limit - количество транзакций (по умолчанию 50, макс 100)
 * @query offset - смещение для пагинации
 */
router.get('/transactions', getTransactions);

export default router;
