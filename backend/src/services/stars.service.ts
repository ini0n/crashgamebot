import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { referralService } from './referral.service';
import { Prisma, TransactionType, TransactionStatus, CurrencyType } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * Stars Payment Service
 * 
 * Сервис для работы с Telegram Stars платежами
 */
class StarsService {
  private readonly MIN_STARS_AMOUNT = 1;
  private readonly MAX_STARS_AMOUNT = 2500; // Telegram limit

  /**
   * Создать pending транзакцию для Stars депозита
   * @param chatId - ID пользователя
   * @param amount - Сумма в Stars
   * @returns ID транзакции (используется как payload)
   */
  async createPendingDeposit(chatId: string, amount: number): Promise<string> {
    try {
      // Валидация суммы
      if (amount < this.MIN_STARS_AMOUNT || amount > this.MAX_STARS_AMOUNT) {
        throw new Error(`Amount must be between ${this.MIN_STARS_AMOUNT} and ${this.MAX_STARS_AMOUNT} Stars`);
      }

      // Проверяем существование пользователя
      const user = await prisma.user.findUnique({
        where: { chatId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Создаем pending транзакцию
      const transaction = await prisma.transaction.create({
        data: {
          chatId,
          type: TransactionType.deposit,
          amount: amount.toString(),
          currency: CurrencyType.stars,
          status: TransactionStatus.pending,
          externalId: randomUUID(), // Временный ID, будет заменен на telegram_payment_charge_id
          metadata: {
            createdVia: 'telegram_stars_invoice',
            timestamp: new Date().toISOString()
          }
        }
      });

      logger.info('Stars pending deposit created', {
        transactionId: transaction.id,
        chatId,
        amount
      });

      return transaction.id;
    } catch (error) {
      logger.error('Error creating pending Stars deposit:', { error, chatId, amount });
      throw error;
    }
  }

  /**
   * Подтвердить Stars депозит после успешной оплаты
   * @param transactionId - ID транзакции
   * @param telegramChargeId - Telegram payment charge ID
   * @returns Обновленная транзакция
   */
  async confirmDeposit(transactionId: string, telegramChargeId: string) {
    try {
      // Используем транзакцию для атомарности
      const result = await prisma.$transaction(async (tx) => {
        // Получаем pending транзакцию
        const transaction = await tx.transaction.findUnique({
          where: { id: transactionId }
        });

        if (!transaction) {
          throw new Error('Transaction not found');
        }

        if (transaction.status !== TransactionStatus.pending) {
          throw new Error('Transaction is not in pending status');
        }

        // Получаем информацию о пользователе для проверки реферера
        const user = await tx.user.findUnique({
          where: { chatId: transaction.chatId },
          select: {
            referrer: true,
            referrerUser: {
              select: {
                chatId: true,
                referralType: true
              }
            }
          }
        });

        // Обновляем транзакцию
        const updatedTransaction = await tx.transaction.update({
          where: { id: transactionId },
          data: {
            status: TransactionStatus.completed,
            externalId: telegramChargeId,
            metadata: {
              ...(transaction.metadata as object || {}),
              completedAt: new Date().toISOString(),
              telegramChargeId
            }
          }
        });

        // Зачисляем Stars на баланс
        const updatedUser = await tx.user.update({
          where: { chatId: transaction.chatId },
          data: {
            starsBalance: {
              increment: parseInt(transaction.amount.toString())
            },
            lastActivity: new Date()
          }
        });

        // Обработка реферального бонуса (если есть реферер)
        let referralBonus = null;
        if (user?.referrer) {
          referralBonus = await referralService.processDepositCommission(
            transaction.chatId,
            transaction.amount.toString(),
            updatedTransaction.id,
            tx,
            CurrencyType.stars
          );
        }

        logger.info('Stars deposit confirmed', {
          transactionId,
          chatId: transaction.chatId,
          amount: transaction.amount,
          newBalance: updatedUser.starsBalance,
          telegramChargeId,
          referralBonus
        });

        return {
          transaction: updatedTransaction,
          newBalance: updatedUser.starsBalance,
          referralBonus
        };
      });

      return result;
    } catch (error) {
      logger.error('Error confirming Stars deposit:', { error, transactionId, telegramChargeId });
      throw error;
    }
  }

  /**
   * Отменить Stars депозит (если платеж не прошел)
   * @param transactionId - ID транзакции
   */
  async cancelDeposit(transactionId: string): Promise<void> {
    try {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.cancelled,
          metadata: {
            cancelledAt: new Date().toISOString()
          }
        }
      });

      logger.info('Stars deposit cancelled', { transactionId });
    } catch (error) {
      logger.error('Error cancelling Stars deposit:', { error, transactionId });
      throw error;
    }
  }

  /**
   * Получить статистику Stars депозитов пользователя
   */
  async getUserStarsDepositStats(chatId: string) {
    try {
      const stats = await prisma.transaction.aggregate({
        where: {
          chatId,
          type: TransactionType.deposit,
          currency: CurrencyType.stars,
          status: TransactionStatus.completed
        },
        _sum: {
          amount: true
        },
        _count: {
          id: true
        }
      });

      return {
        totalAmount: parseInt(stats._sum.amount?.toString() || '0'),
        totalCount: stats._count.id
      };
    } catch (error) {
      logger.error('Error getting Stars deposit stats:', { error, chatId });
      throw error;
    }
  }
}

export const starsService = new StarsService();

