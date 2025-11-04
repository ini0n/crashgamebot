import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { Prisma, CurrencyType, ReferralEarningType } from '@prisma/client';
import Decimal from 'decimal.js';

/**
 * Referral Service
 * 
 * Сервис для работы с реферальной программой
 * 
 * Правила:
 * - Basic: 10% от депозита реферала
 * - Plus: 10% от депозита + 50% от проигрыша реферала (управляется вручную)
 */
class ReferralService {
  /**
   * Комиссия за депозит (только для Basic и Plus программ)
   */
  private readonly DEPOSIT_COMMISSION_RATE = 0.1; // 10%

  /**
   * Обработка реферальной комиссии за депозит
   * 
   * @param referredChatId - ID пользователя, который сделал депозит
   * @param depositAmount - сумма депозита (строка для точности)
   * @param transactionId - ID транзакции депозита
   * @param prismaTransaction - Prisma транзакция для атомарности
   * @param currency - валюта депозита (по умолчанию TON для обратной совместимости)
   * @returns объект с информацией о начислении или null если нет реферера
   */
  async processDepositCommission(
    referredChatId: string,
    depositAmount: string,
    transactionId: string,
    prismaTransaction: Prisma.TransactionClient,
    currency: CurrencyType = CurrencyType.ton
  ): Promise<{ referrerChatId: string; commissionAmount: string } | null> {
    try {
      // Получаем информацию о пользователе, который сделал депозит
      const referredUser = await prismaTransaction.user.findUnique({
        where: { chatId: referredChatId },
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

      // Если нет реферера - возвращаем null
      if (!referredUser?.referrer || !referredUser.referrerUser) {
        logger.debug('No referrer for user', { referredChatId });
        return null;
      }

      const referrerChatId = referredUser.referrerUser.chatId;

      // Рассчитываем комиссию: 10% от депозита
      const depositDecimal = new Decimal(depositAmount);
      const commissionDecimal = depositDecimal.mul(this.DEPOSIT_COMMISSION_RATE);
      const commissionAmount = commissionDecimal.toString();

      logger.debug('Processing referral deposit commission', {
        referredChatId,
        referrerChatId,
        depositAmount,
        commissionAmount,
        currency,
        commissionRate: `${this.DEPOSIT_COMMISSION_RATE * 100}%`
      });

      // Создаем запись о реферальном начислении
      await prismaTransaction.referralEarning.create({
        data: {
          referrerChatId,
          referredChatId,
          transactionId,
          amount: commissionAmount,
          currency,
          type: ReferralEarningType.deposit_commission
        }
      });

      // Зачисляем комиссию на баланс реферера (в зависимости от валюты)
      const balanceUpdate = currency === CurrencyType.ton 
        ? { tonBalance: { increment: commissionAmount } }
        : { starsBalance: { increment: parseInt(commissionAmount) } };

      await prismaTransaction.user.update({
        where: { chatId: referrerChatId },
        data: {
          ...balanceUpdate,
          lastActivity: new Date()
        }
      });

      logger.debug('Referral commission credited', {
        referrerChatId,
        referredChatId,
        commissionAmount
      });

      return {
        referrerChatId,
        commissionAmount
      };
    } catch (error) {
      logger.error('Error processing referral deposit commission:', {
        error,
        referredChatId,
        depositAmount,
        transactionId
      });
      throw error;
    }
  }

  /**
   * Получение статистики реферальных заработков
   * 
   * @param referrerChatId - ID реферера
   * @returns статистика заработков
   */
  async getReferralEarningsStats(referrerChatId: string) {
    try {
      const stats = await prisma.referralEarning.aggregate({
        where: {
          referrerChatId
        },
        _sum: {
          amount: true
        },
        _count: {
          id: true
        }
      });

      const depositStats = await prisma.referralEarning.aggregate({
        where: {
          referrerChatId,
          type: ReferralEarningType.deposit_commission
        },
        _sum: {
          amount: true
        },
        _count: {
          id: true
        }
      });

      return {
        totalAmount: stats._sum.amount?.toString() || '0',
        totalCount: stats._count.id,
        depositCommissionAmount: depositStats._sum.amount?.toString() || '0',
        depositCommissionCount: depositStats._count.id
      };
    } catch (error) {
      logger.error('Error fetching referral earnings stats:', { error, referrerChatId });
      throw error;
    }
  }

  /**
   * Получение списка рефералов
   * 
   * @param referrerChatId - ID реферера
   * @param limit - количество рефералов
   * @returns массив рефералов
   */
  async getReferrals(referrerChatId: string, limit: number = 50) {
    try {
      const referrals = await prisma.user.findMany({
        where: {
          referrer: referrerChatId
        },
        select: {
          chatId: true,
          username: true,
          firstname: true,
          createdAt: true,
          lastActivity: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit
      });

      return referrals;
    } catch (error) {
      logger.error('Error fetching referrals:', { error, referrerChatId });
      throw error;
    }
  }
}

export const referralService = new ReferralService();

