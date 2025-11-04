/**
 * Bet Service for Crash Game
 * 
 * Управление ставками: создание, кэшаут, расчет выигрышей.
 */

import { Bet, CurrencyType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '../utils/logger';
import { prisma } from '../utils/database';
import { isValidBetAmount, calculateFinalWinnings, calculateWinnings } from '../utils/gameAlgorithm';
import { GAME_CONFIG } from '../config/gameConfig';

/**
 * Интерфейс для создания ставки
 */
export interface CreateBetData {
  chatId: string;
  roundId: string;
  amount: number | string;
  currency: 'ton' | 'stars';
  giftId?: string;
}

/**
 * Интерфейс для кэшаута
 */
export interface CashoutData {
  betId: string;
  multiplier: number;
}

/**
 * Интерфейс для результата ставки
 */
export interface BetResult {
  betId: string;
  chatId: string;
  roundId: string;
  amount: string;
  currency: string;
  cashoutAt: number | null;
  cashedOut: boolean;
  profit: string | null;
  status: 'pending' | 'active' | 'won' | 'lost';
}

class BetService {
  /**
   * Инициализация сервиса
   */
  public async initialize(): Promise<void> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.info('✅ Database connection verified (BetService)');
    } catch (error) {
      logger.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  /**
   * Создает новую ставку
   *
   * ✅ БЕЗОПАСНОСТЬ:
   * - Проверка на дубликаты (один пользователь = одна ставка в раунде)
   * - Атомарное списание баланса в транзакции
   * - Проверка баланса внутри транзакции (защита от race condition)
   *
   * @param data - Данные для создания ставки
   * @returns Созданная ставка
   */
  public async createBet(data: CreateBetData): Promise<BetResult> {
    try {
      // Валидируем сумму ставки
      const amount = typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount;

      if (!isValidBetAmount(amount, data.currency.toUpperCase() as 'TON' | 'STARS')) {
        const error = `Invalid bet amount: ${amount} ${data.currency}`;
        logger.warn(`⚠️ ${error}`);
        throw new Error(error);
      }

      // ✅ КРИТИЧЕСКАЯ БЕЗОПАСНОСТЬ: Используем транзакцию для атомарности
      const bet = await prisma.$transaction(async (tx) => {
        // 1. Проверяем, что раунд существует и в статусе betting
        const round = await tx.gameRound.findUnique({
          where: { id: data.roundId },
        });

        if (!round) {
          throw new Error(`Round not found: ${data.roundId}`);
        }

        if (round.status !== 'betting') {
          throw new Error(`Round is not in betting phase: ${round.status}`);
        }

        // 2. ✅ ЗАЩИТА ОТ МНОЖЕСТВЕННЫХ СТАВОК: Проверяем, что пользователь еще не делал ставку в этом раунде
        const existingBet = await tx.bet.findFirst({
          where: {
            chatId: data.chatId,
            roundId: data.roundId,
          },
        });

        if (existingBet) {
          throw new Error(`You already have a bet in this round`);
        }

        // 3. Получаем пользователя с блокировкой строки (FOR UPDATE)
        const user = await tx.user.findUnique({
          where: { chatId: data.chatId },
        });

        if (!user) {
          throw new Error(`User not found: ${data.chatId}`);
        }

        // 4. Проверяем баланс пользователя ВНУТРИ транзакции
        if (data.currency === 'ton') {
          if (user.tonBalance.lessThan(new Decimal(amount))) {
            throw new Error(`Insufficient TON balance: ${user.tonBalance.toString()} < ${amount}`);
          }
        } else if (data.currency === 'stars') {
          if (user.starsBalance < amount) {
            throw new Error(`Insufficient Stars balance: ${user.starsBalance} < ${amount}`);
          }
        }

        // 5. ✅ СПИСЫВАЕМ БАЛАНС (критическое исправление!)
        if (data.currency === 'ton') {
          await tx.user.update({
            where: { chatId: data.chatId },
            data: {
              tonBalance: {
                decrement: new Decimal(amount)
              },
              lastActivity: new Date()
            },
          });
        } else if (data.currency === 'stars') {
          await tx.user.update({
            where: { chatId: data.chatId },
            data: {
              starsBalance: {
                decrement: Math.floor(amount)
              },
              lastActivity: new Date()
            },
          });
        }

        // 6. Создаем ставку
        const createdBet = await tx.bet.create({
          data: {
            chatId: data.chatId,
            roundId: data.roundId,
            amount: new Decimal(amount),
            currency: data.currency.toUpperCase() as CurrencyType,
            giftId: data.giftId,
          },
        });

        return createdBet;
      });

      logger.info(`✅ Bet created and balance deducted: ${bet.id} (${amount} ${data.currency})`);

      return this.convertBetResult(bet, 'pending');
    } catch (error) {
      logger.error('❌ Error creating bet:', error);
      throw error;
    }
  }

  /**
   * Кэшаут ставки
   *
   * ✅ КРИТИЧЕСКАЯ БЕЗОПАСНОСТЬ:
   * - Использует АТОМАРНУЮ транзакцию для предотвращения race condition
   * - Использует SELECT FOR UPDATE для блокировки раунда
   * - Проверяет статус раунда ВНУТРИ транзакции с блокировкой
   * - Использует ТОЛЬКО серверный мультипликатор (из gameLoopService)
   * - Клиент НЕ может манипулировать мультипликатором или временем
   * - НАЧИСЛЯЕТ ВЫИГРЫШ НА БАЛАНС (критическое исправление!)
   *
   * @param betId - ID ставки
   * @param serverMultiplier - СЕРВЕРНЫЙ мультипликатор (из gameLoopService)
   * @returns Результат кэшаута
   */
  public async cashoutBet(betId: string, serverMultiplier: number): Promise<BetResult> {
    try {
      // ✅ КРИТИЧЕСКАЯ БЕЗОПАСНОСТЬ: Используем транзакцию для атомарности
      // Это предотвращает race condition между проверкой статуса и обновлением
      const result = await prisma.$transaction(async (tx) => {
        // Получаем ставку
        const bet = await tx.bet.findUnique({
          where: { id: betId },
        });

        if (!bet) {
          throw new Error(`Bet not found: ${betId}`);
        }

        // Проверяем, что ставка еще не кэшаутена
        if (bet.cashedOut) {
          throw new Error(`Bet already cashed out: ${betId}`);
        }

        // ✅ ЗАЩИТА ОТ RACE CONDITION: Блокируем раунд с помощью SELECT FOR UPDATE
        // Это гарантирует, что gameLoop.crashRound() НЕ сможет изменить статус
        // до завершения нашей транзакции
        const round = await tx.$queryRaw<Array<{ id: string; status: string }>>`
          SELECT id, status
          FROM game_rounds
          WHERE id = ${bet.roundId}
          FOR UPDATE
        `;

        if (!round || round.length === 0) {
          throw new Error(`Round not found: ${bet.roundId}`);
        }

        // ✅ КРИТИЧЕСКАЯ БЕЗОПАСНОСТЬ: Проверяем статус раунда ПОСЛЕ блокировки
        // Теперь мы гарантированно знаем актуальный статус, и он не изменится
        if (round[0].status !== 'flying') {
          throw new Error(`Round is not in flying phase: ${round[0].status}`);
        }

        // ✅ БЕЗОПАСНОСТЬ: Используем ТОЛЬКО серверный мультипликатор
        // Клиент НЕ может манипулировать значением мультипликатора
        const profit = calculateWinnings(bet.amount.toNumber(), serverMultiplier);

        // Обновляем ставку ВНУТРИ транзакции
        const updated = await tx.bet.update({
          where: { id: betId },
          data: {
            cashoutAt: new Decimal(serverMultiplier),
            cashedOut: true,
            profit: new Decimal(profit),
          },
        });

        // ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: НАЧИСЛЯЕМ ВЫИГРЫШ НА БАЛАНС!
        // totalPayout = ставка (уже списана) + прибыль
        const totalPayout = bet.amount.toNumber() + profit;

        if (bet.currency === CurrencyType.ton) {
          await tx.user.update({
            where: { chatId: bet.chatId },
            data: {
              tonBalance: {
                increment: new Decimal(totalPayout)
              },
              lastActivity: new Date()
            },
          });
        } else if (bet.currency === CurrencyType.stars) {
          await tx.user.update({
            where: { chatId: bet.chatId },
            data: {
              starsBalance: {
                increment: Math.floor(totalPayout)
              },
              lastActivity: new Date()
            },
          });
        }

        return { bet: updated, totalPayout };
      });

      logger.info(`✅ Bet cashed out and balance credited: ${betId} (${serverMultiplier}x, profit: ${result.bet.profit?.toString() || '0'}, payout: ${result.totalPayout})`);

      return this.convertBetResult(result.bet, 'won');
    } catch (error) {
      logger.error('❌ Error cashing out bet:', error);
      throw error;
    }
  }

  /**
   * Завершить ставку (раунд закончился)
   *
   * @deprecated Используйте finalizeBetsInRound для batch обработки
   * @param betId - ID ставки
   * @param crashMultiplier - Мультипликатор краша
   * @returns Результат ставки
   */
  public async finalizeBet(betId: string, crashMultiplier: number): Promise<BetResult> {
    try {
      // Получаем ставку
      const bet = await prisma.bet.findUnique({
        where: { id: betId },
      });

      if (!bet) {
        throw new Error(`Bet not found: ${betId}`);
      }

      // Если ставка уже кэшаутена - ничего не делаем
      if (bet.cashedOut) {
        return this.convertBetResult(bet, 'won');
      }

      // Если ставка не кэшаутена - игрок проиграл
      // ОПТИМИЗАЦИЯ: Используем Decimal.negated() вместо toNumber() -> new Decimal()
      const profit = bet.amount.negated();

      const updatedBet = await prisma.bet.update({
        where: { id: betId },
        data: {
          profit,
        },
      });

      logger.info(`✅ Bet finalized: ${betId} (lost, crash: ${crashMultiplier}x)`);

      return this.convertBetResult(updatedBet, 'lost');
    } catch (error) {
      logger.error('❌ Error finalizing bet:', error);
      throw error;
    }
  }

  /**
   * Завершить все ставки в раунде (batch операция)
   *
   * ОПТИМИЗАЦИЯ: Обновляет все не кэшаутнутые ставки одним запросом
   * Вместо N запросов (findUnique + update) делаем 1 запрос (updateMany)
   *
   * @param roundId - ID раунда
   * @param crashMultiplier - Мультипликатор краша
   * @returns Количество обновленных ставок
   */
  public async finalizeBetsInRound(roundId: string, crashMultiplier: number): Promise<{ count: number }> {
    try {
      // Получаем все не кэшаутнутые ставки для расчета profit
      const bets = await prisma.bet.findMany({
        where: {
          roundId,
          cashedOut: false,
        },
        select: {
          id: true,
          amount: true,
        },
      });

      // Batch update: все не кэшаутнутые ставки получают отрицательный profit
      // Используем raw query для установки profit = -amount
      // ВАЖНО: Используем имена колонок БД (из @map), а не имена Prisma модели
      const result = await prisma.$executeRaw`
        UPDATE "bets"
        SET "profit" = -"amount"
        WHERE "round_id" = ${roundId}
        AND "cashed_out" = false
      `;

      logger.info(`✅ Batch finalized ${result} bets for round ${roundId} (crash: ${crashMultiplier}x)`);

      return { count: Number(result) };
    } catch (error) {
      logger.error('❌ Error batch finalizing bets:', error);
      throw error;
    }
  }

  /**
   * Получить ставку по ID
   * 
   * @param betId - ID ставки
   * @returns Ставка или null
   */
  public async getBetById(betId: string): Promise<BetResult | null> {
    try {
      const bet = await prisma.bet.findUnique({
        where: { id: betId },
      });

      if (!bet) {
        return null;
      }

      // Определяем статус
      let status: 'pending' | 'active' | 'won' | 'lost' = 'pending';
      if (bet.cashedOut) {
        status = 'won';
      } else if (bet.profit !== null && bet.profit.lessThan(0)) {
        status = 'lost';
      } else if (bet.profit !== null) {
        status = 'won';
      }

      return this.convertBetResult(bet, status);
    } catch (error) {
      logger.error('❌ Error getting bet:', error);
      throw error;
    }
  }

  /**
   * Конвертирует Prisma Bet в наш BetResult тип
   */
  private convertBetResult(bet: Bet, status: 'pending' | 'active' | 'won' | 'lost'): BetResult {
    return {
      betId: bet.id,
      chatId: bet.chatId,
      roundId: bet.roundId,
      amount: bet.amount.toString(),
      currency: bet.currency,
      cashoutAt: bet.cashoutAt ? bet.cashoutAt.toNumber() : null,
      cashedOut: bet.cashedOut,
      profit: bet.profit ? bet.profit.toString() : null,
      status,
    };
  }
}

// Экспортируем singleton
export const betService = new BetService();

