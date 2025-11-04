import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { Prisma, TransactionType, TransactionStatus, CurrencyType } from '@prisma/client';

/**
 * Transaction Service
 * 
 * Сервис для работы с транзакциями TON депозитов
 */
class TransactionService {
  /**
   * Проверка существования транзакции по хешу
   * @param txHash - хеш транзакции из блокчейна
   * @returns true если транзакция уже обработана
   */
  async existsByHash(txHash: string): Promise<boolean> {
    try {
      const transaction = await prisma.transaction.findFirst({
        where: {
          externalId: txHash
        }
      });
      
      return !!transaction;
    } catch (error) {
      logger.error('Error checking transaction existence:', { error, txHash });
      throw error;
    }
  }

  /**
   * Создание записи транзакции
   * @param data - данные транзакции
   * @param prismaTransaction - опциональная Prisma транзакция для атомарности
   * @returns созданная транзакция
   */
  async create(
    data: {
      chatId: string;
      type: TransactionType;
      amount: string; // Decimal as string
      currency: CurrencyType;
      status: TransactionStatus;
      externalId: string;
      metadata?: Record<string, any>;
    },
    prismaTransaction?: Prisma.TransactionClient
  ) {
    try {
      const prismaClient = prismaTransaction || prisma;

      const transaction = await prismaClient.transaction.create({
        data: {
          chatId: data.chatId,
          type: data.type,
          amount: data.amount,
          currency: data.currency,
          status: data.status,
          externalId: data.externalId,
          metadata: data.metadata || {}
        }
      });

      logger.debug('Transaction created', {
        id: transaction.id,
        chatId: data.chatId,
        type: data.type,
        amount: data.amount,
        externalId: data.externalId
      });

      return transaction;
    } catch (error) {
      logger.error('Error creating transaction:', { error, data });
      throw error;
    }
  }

  /**
   * Зачисление средств на баланс пользователя
   * @param chatId - ID пользователя
   * @param amount - сумма для зачисления (строка для точности)
   * @param prismaTransaction - опциональная Prisma транзакция для атомарности
   * @returns обновленный пользователь
   */
  async creditUserBalance(
    chatId: string,
    amount: string,
    prismaTransaction?: Prisma.TransactionClient
  ) {
    try {
      const prismaClient = prismaTransaction || prisma;

      const updatedUser = await prismaClient.user.update({
        where: { chatId },
        data: {
          tonBalance: {
            increment: amount
          },
          lastActivity: new Date()
        }
      });

      logger.info('User balance credited', {
        chatId,
        amount,
        newBalance: updatedUser.tonBalance.toString()
      });

      return updatedUser;
    } catch (error) {
      logger.error('Error crediting user balance:', { error, chatId, amount });
      throw error;
    }
  }

  /**
   * Получение истории транзакций пользователя
   * @param chatId - ID пользователя
   * @param limit - количество транзакций
   * @returns массив транзакций
   */
  async getUserTransactions(chatId: string, limit: number = 50) {
    try {
      const transactions = await prisma.transaction.findMany({
        where: { chatId },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return transactions;
    } catch (error) {
      logger.error('Error fetching user transactions:', { error, chatId });
      throw error;
    }
  }

  /**
   * Получение статистики депозитов пользователя
   * @param chatId - ID пользователя
   * @returns статистика депозитов
   */
  async getUserDepositStats(chatId: string) {
    try {
      const stats = await prisma.transaction.aggregate({
        where: {
          chatId,
          type: 'deposit',
          status: 'completed'
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
        totalCount: stats._count.id
      };
    } catch (error) {
      logger.error('Error fetching deposit stats:', { error, chatId });
      throw error;
    }
  }
}

export const transactionService = new TransactionService();

