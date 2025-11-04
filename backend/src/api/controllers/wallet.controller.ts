import { Response } from 'express';
import { walletService } from '../../services/wallet.service';
import { transactionService } from '../../services/transaction.service';
import { userService } from '../../services/user.service';
import { logger } from '../../utils/logger';
import { AuthenticatedRequest } from '../middlewares/auth';
import {
  ApiResponse,
  ConnectWalletRequest,
  ConnectWalletResponse,
  WalletStatusResponse,
  BalanceResponse,
  TransactionHistoryResponse,
  TransactionItem
} from '../../../../shared/types/api';

/**
 * Подключить TON кошелек
 * POST /api/wallet/connect
 */
export const connectWallet = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { walletAddress }: ConnectWalletRequest = req.body;
    const chatId = req.user?.chatId;

    if (!chatId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as ApiResponse);
      return;
    }

    if (!walletAddress || typeof walletAddress !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      } as ApiResponse);
      return;
    }

    // Подключаем кошелек
    const result = await walletService.connectWallet(chatId, walletAddress);

    const response: ConnectWalletResponse = {
      walletAddress: result.walletAddress,
      connectedAt: result.connectedAt.toISOString()
    };

    res.json({
      success: true,
      data: response
    } as ApiResponse<ConnectWalletResponse>);

  } catch (error) {
    logger.error('Connect wallet API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
    
    res.status(400).json({
      success: false,
      error: errorMessage
    } as ApiResponse);
  }
};

/**
 * Отключить TON кошелек
 * POST /api/wallet/disconnect
 */
export const disconnectWallet = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const chatId = req.user?.chatId;

    if (!chatId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as ApiResponse);
      return;
    }

    // Отключаем кошелек
    await walletService.disconnectWallet(chatId);

    res.json({
      success: true,
      data: { message: 'Wallet disconnected successfully' }
    } as ApiResponse);

  } catch (error) {
    logger.error('Disconnect wallet API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect wallet';
    
    res.status(400).json({
      success: false,
      error: errorMessage
    } as ApiResponse);
  }
};

/**
 * Получить статус кошелька
 * GET /api/wallet/status
 */
export const getWalletStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const chatId = req.user?.chatId;

    if (!chatId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as ApiResponse);
      return;
    }

    // Получаем статус кошелька
    const status = await walletService.getWalletStatus(chatId);

    const response: WalletStatusResponse = {
      isConnected: status.isConnected,
      walletAddress: status.walletAddress,
      connectedAt: status.connectedAt?.toISOString()
    };

    res.json({
      success: true,
      data: response
    } as ApiResponse<WalletStatusResponse>);

  } catch (error) {
    logger.error('Get wallet status API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to get wallet status';
    
    res.status(500).json({
      success: false,
      error: errorMessage
    } as ApiResponse);
  }
};

/**
 * Получить баланс пользователя
 * GET /api/wallet/balance
 */
export const getBalance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const chatId = req.user?.chatId;

    if (!chatId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as ApiResponse);
      return;
    }

    // Получаем пользователя напрямую из БД
    const user = await userService.findByChatId(chatId);

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      } as ApiResponse);
      return;
    }

    const response: BalanceResponse = {
      tonBalance: user.tonBalance,
      starsBalance: user.starsBalance,
      giftsBalance: 0 // TODO: добавить поле giftsBalance в модель User
    };

    res.json({
      success: true,
      data: response
    } as ApiResponse<BalanceResponse>);

  } catch (error) {
    logger.error('Get balance API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to get balance';
    
    res.status(500).json({
      success: false,
      error: errorMessage
    } as ApiResponse);
  }
};

/**
 * Получить историю транзакций пользователя
 * GET /api/wallet/transactions
 */
export const getTransactions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const chatId = req.user?.chatId;

    if (!chatId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as ApiResponse);
      return;
    }

    // Параметры пагинации
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Максимум 100
    const offset = parseInt(req.query.offset as string) || 0;

    // Получаем транзакции
    const transactions = await transactionService.getUserTransactions(chatId, limit + 1); // +1 для hasMore

    // Проверяем есть ли еще транзакции
    const hasMore = transactions.length > limit;
    const items = hasMore ? transactions.slice(0, limit) : transactions;

    // Преобразуем в формат API
    const transactionItems: TransactionItem[] = items.map(tx => ({
      id: tx.id,
      type: tx.type as TransactionItem['type'],
      amount: tx.amount.toString(),
      currency: tx.currency as TransactionItem['currency'],
      status: tx.status as TransactionItem['status'],
      createdAt: tx.createdAt.toISOString(),
      externalId: tx.externalId || undefined,
      metadata: tx.metadata as Record<string, any> || undefined
    }));

    const response: TransactionHistoryResponse = {
      transactions: transactionItems,
      totalCount: transactionItems.length,
      hasMore
    };

    res.json({
      success: true,
      data: response
    } as ApiResponse<TransactionHistoryResponse>);

  } catch (error) {
    logger.error('Get transactions API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to get transactions';
    
    res.status(500).json({
      success: false,
      error: errorMessage
    } as ApiResponse);
  }
};
