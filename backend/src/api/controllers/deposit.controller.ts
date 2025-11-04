import { Response } from 'express';
import { z } from 'zod';
import { BaseController } from './base.controller';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';
import { starsService } from '../../services/stars.service';
import { telegramService } from '../../services/telegram.service';
import type { AuthenticatedRequest } from '../middlewares/auth';
import type { ApiResponse, StarsDepositRequest, StarsDepositResponse } from '../../../../shared/types/api';

// Схема валидации запроса депозита
const depositRequestSchema = z.object({
  amount: z.string().regex(/^\d+\.?\d*$/, 'Invalid amount format')
});

interface DepositRequest {
  amount: string;
}

interface DepositResponse {
  depositAddress: string;
  amount: string;
  comment: string;
  network: string;
}

export class DepositController extends BaseController {

  /**
   * @route POST /api/deposit/get
   * @desc Получает депозитный адрес с уникальным комментарием для транзакции
   * @access Private
   * @body { amount: string }
   */
  public getDepositAddress = this.asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { amount }: DepositRequest = depositRequestSchema.parse(req.body);
      const chatId = req.user?.chatId;

      if (!chatId) {
        this.validationError(res, 'Authentication required');
        return;
      }

      if (!config.ton.depositAddress) {
        this.error(res, 'Deposit address not configured', 500, new Error('TON_DEPOSIT_ADDRESS not set'));
        return;
      }

      const amountNum = parseFloat(amount);
      if (amountNum < config.ton.minDepositTon || amountNum > config.ton.maxDepositTon) {
        this.validationError(res, `Amount must be between ${config.ton.minDepositTon} and ${config.ton.maxDepositTon} TON`);
        return;
      }

      // Генерируем комментарий для идентификации пользователя
      const comment = `dep_${chatId}`;

      const response: DepositResponse = {
        depositAddress: config.ton.depositAddress,
        amount: amount,
        comment: comment,
        network: config.ton.network
      };

      logger.info('Deposit address generated:', {
        chatId,
        amount,
        comment,
        network: config.ton.network
      });

      this.success(res, response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.validationError(res, error.errors[0].message);
        return;
      }

      logger.error('Failed to generate deposit address:', {
        chatId: req.user?.chatId,
        error: error instanceof Error ? error.message : error
      });

      this.error(res, 'Unable to process deposit request. Please try again later.', 500, error as Error);
    }
  });

  /**
   * @route POST /api/deposit/stars
   * @desc Создает Stars invoice для пополнения баланса
   * @access Private
   * @body { amount: number }
   */
  public createStarsInvoice = this.asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { amount }: StarsDepositRequest = req.body;
      const chatId = req.user?.chatId;

      if (!chatId) {
        this.validationError(res, 'Authentication required');
        return;
      }

      // Проверяем готовность бота
      if (!telegramService.isBotReady()) {
        logger.warn('Stars payment attempt while bot not ready', { chatId });
        this.error(res, 'Telegram bot is initializing. Please wait a moment and try again.', 503, new Error('Bot initialization in progress or failed'));
        return;
      }

      // Получаем экземпляр бота через сервис
      let bot;
      try {
        bot = telegramService.getBotInstance();
      } catch (error) {
        this.error(res, 'Bot instance not configured', 500, error as Error);
        return;
      }

      // Валидация суммы
      if (!Number.isInteger(amount) || amount < 1 || amount > 2500) {
        this.validationError(res, 'Amount must be an integer between 1 and 2500 Stars');
        return;
      }

      // Создаем pending транзакцию
      const transactionId = await starsService.createPendingDeposit(chatId, amount);

      // Создаем invoice через Telegram Bot API
      const invoiceLink = await bot.telegram.createInvoiceLink({
        title: 'Пополнение Stars',
        description: `Пополнение баланса на ${amount} Stars`,
        payload: transactionId, // ID транзакции для идентификации
        provider_token: '', // Пустой для Stars (XTR)
        currency: 'XTR', // Telegram Stars currency code
        prices: [
          {
            label: 'Stars',
            amount: amount // В Stars (не копейках, для XTR 1 = 1 Star)
          }
        ]
      });

      const response: StarsDepositResponse = {
        invoiceLink,
        paymentId: transactionId
      };

      logger.info('Stars invoice created:', {
        chatId,
        amount,
        transactionId,
        invoiceLink
      });

      this.success(res, response);
    } catch (error) {
      logger.error('Failed to create Stars invoice:', {
        chatId: req.user?.chatId,
        error: error instanceof Error ? error.message : error
      });

      this.error(res, 'Unable to create payment invoice. Please try again later.', 500, error as Error);
    }
  });

}

export const depositController = new DepositController();
