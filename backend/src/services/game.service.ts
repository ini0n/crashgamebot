/**
 * Game Service for Crash Game
 * 
 * Управление игровыми раундами, ставками и состоянием игры.
 */

import { GameRound, Bet, GameStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { prisma } from '../utils/database';
import { generateServerSeed, generateClientSeed, calculateHash } from '../utils/provablyFair';
import { generateCrashMultiplierRounded, isValidBetAmount, calculateFinalWinnings } from '../utils/gameAlgorithm';
import { GAME_CONFIG } from '../config/gameConfig';

/**
 * Интерфейс для создания раунда
 */
export interface CreateRoundData {
  crashPoint?: number; // Опционально, если не указано - генерируется
  serverSeed?: string; // Опционально, если не указано - генерируется
}

/**
 * Интерфейс для информации о раунде
 *
 * ⚠️ БЕЗОПАСНОСТЬ:
 * - crashPoint и serverSeed опциональны
 * - Возвращаются ТОЛЬКО для завершенных раундов (status === 'crashed')
 */
export interface RoundData {
  id: string;
  crashPoint?: number;  // ✅ Опционально - только для завершенных раундов
  serverSeed?: string;  // ✅ Опционально - только для завершенных раундов
  hashedServerSeed: string;
  status: GameStatus;
  houseFee: number;
  startTime: Date;
  endTime: Date | null;
  createdAt: Date;
  betsCount?: number;
  totalBetAmount?: string;
}

/**
 * ❌ ПРИВАТНЫЙ интерфейс для ПОЛНЫХ данных раунда
 * Используется ТОЛЬКО внутри сервиса для gameLoopService
 */
export interface RoundDataFull {
  id: string;
  crashPoint: number;   // ❌ ВСЕГДА присутствует
  serverSeed: string;   // ❌ ВСЕГДА присутствует
  hashedServerSeed: string;
  status: GameStatus;
  houseFee: number;
  startTime: Date;
  endTime: Date | null;
  createdAt: Date;
  betsCount?: number;
  totalBetAmount?: string;
}

/**
 * Интерфейс для информации о ставке
 */
export interface BetData {
  id: string;
  chatId: string;
  roundId: string;
  amount: string;
  currency: string;
  cashoutAt: number | null;
  cashedOut: boolean;
  profit: string | null;
  createdAt: Date;
}

class GameService {
  /**
   * Инициализация сервиса
   */
  public async initialize(): Promise<void> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.info('✅ Database connection verified (GameService)');
    } catch (error) {
      logger.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  /**
   * Создает новый раунд игры
   *
   * ⚠️ ВНИМАНИЕ: Возвращает ПОЛНЫЕ данные включая crashPoint и serverSeed
   * Используется ТОЛЬКО для gameLoopService
   *
   * @param data - Данные для создания раунда
   * @returns Созданный раунд с ПОЛНЫМИ данными
   */
  public async createRound(data: CreateRoundData = {}): Promise<RoundDataFull> {
    try {
      // Генерируем serverSeed если не предоставлен
      const serverSeed = data.serverSeed || generateServerSeed();

      // Генерируем crashPoint если не предоставлен
      let crashPoint = data.crashPoint;
      if (crashPoint === undefined) {
        // Генерируем случайный clientSeed для определения crashPoint
        const clientSeed = generateClientSeed();
        crashPoint = generateCrashMultiplierRounded(serverSeed, clientSeed);
      }

      // Хешируем serverSeed для скрытия от клиента
      const hashedServerSeed = calculateHash(serverSeed, '');

      // Создаем раунд в БД
      const round = await prisma.gameRound.create({
        data: {
          crashPoint: new Decimal(crashPoint),
          serverSeed,
          hashedServerSeed,
          status: 'betting' as GameStatus,
          houseFee: new Decimal(GAME_CONFIG.HOUSE_FEE),
          startTime: new Date(),
        },
      });

      // ✅ БЕЗОПАСНОСТЬ: Не логируем crashPoint
      logger.info(`✅ Game round created: ${round.id}`);

      // Используем FULL конвертацию для внутреннего использования (gameLoopService)
      return this.convertRoundDataFull(round);
    } catch (error) {
      logger.error('❌ Error creating game round:', error);
      throw error;
    }
  }

  /**
   * Получить раунд по ID
   * 
   * @param roundId - ID раунда
   * @returns Раунд или null
   */
  public async getRoundById(roundId: string): Promise<RoundData | null> {
    try {
      const round = await prisma.gameRound.findUnique({
        where: { id: roundId },
        include: {
          bets: true,
        },
      });

      if (!round) {
        return null;
      }

      const roundData = this.convertRoundData(round);

      // Добавляем информацию о ставках
      if (round.bets) {
        roundData.betsCount = round.bets.length;
        roundData.totalBetAmount = round.bets
          .reduce((sum, bet) => sum.plus(bet.amount), new Decimal(0))
          .toString();
      }

      return roundData;
    } catch (error) {
      logger.error('❌ Error getting game round:', error);
      throw error;
    }
  }

  /**
   * Обновить статус раунда
   * 
   * @param roundId - ID раунда
   * @param status - Новый статус
   * @returns Обновленный раунд
   */
  public async updateRoundStatus(roundId: string, status: GameStatus): Promise<RoundData> {
    try {
      const round = await prisma.gameRound.update({
        where: { id: roundId },
        data: {
          status,
          endTime: status === 'crashed' ? new Date() : undefined,
        },
      });

      logger.info(`✅ Game round ${roundId} status updated to: ${status}`);

      return this.convertRoundData(round);
    } catch (error) {
      logger.error('❌ Error updating game round status:', error);
      throw error;
    }
  }

  /**
   * Получить последний раунд
   * 
   * @returns Последний раунд или null
   */
  public async getLastRound(): Promise<RoundData | null> {
    try {
      const round = await prisma.gameRound.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      return round ? this.convertRoundData(round) : null;
    } catch (error) {
      logger.error('❌ Error getting last game round:', error);
      throw error;
    }
  }

  /**
   * Получить активный раунд (статус betting или flying)
   * 
   * @returns Активный раунд или null
   */
  public async getActiveRound(): Promise<RoundData | null> {
    try {
      const round = await prisma.gameRound.findFirst({
        where: {
          status: {
            in: ['betting', 'flying'],
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return round ? this.convertRoundData(round) : null;
    } catch (error) {
      logger.error('❌ Error getting active game round:', error);
      throw error;
    }
  }

  /**
   * Получить ставку по ID
   * 
   * @param betId - ID ставки
   * @returns Ставка или null
   */
  public async getBetById(betId: string): Promise<BetData | null> {
    try {
      const bet = await prisma.bet.findUnique({
        where: { id: betId },
      });

      return bet ? this.convertBetData(bet) : null;
    } catch (error) {
      logger.error('❌ Error getting bet:', error);
      throw error;
    }
  }

  /**
   * Получить ставки пользователя в раунде
   * 
   * @param chatId - Chat ID пользователя
   * @param roundId - ID раунда
   * @returns Массив ставок
   */
  public async getUserBetsInRound(chatId: string, roundId: string): Promise<BetData[]> {
    try {
      const bets = await prisma.bet.findMany({
        where: {
          chatId,
          roundId,
        },
      });

      return bets.map(bet => this.convertBetData(bet));
    } catch (error) {
      logger.error('❌ Error getting user bets in round:', error);
      throw error;
    }
  }

  /**
   * ❌ УДАЛЕН: getRoundBets() - небезопасный метод
   *
   * Причина: Возвращал ВСЕ ставки в раунде, включая ставки других игроков
   * Используйте getUserBetsInRound() вместо этого
   */

  /**
   * ✅ БЕЗОПАСНАЯ конвертация для клиента
   * Возвращает serverSeed и crashPoint ТОЛЬКО для завершенных раундов
   */
  private convertRoundData(round: GameRound): RoundData {
    const baseData: RoundData = {
      id: round.id,
      hashedServerSeed: round.hashedServerSeed,
      status: round.status,
      houseFee: round.houseFee.toNumber(),
      startTime: round.startTime,
      endTime: round.endTime,
      createdAt: round.createdAt,
    };

    // ✅ БЕЗОПАСНОСТЬ: serverSeed и crashPoint только для завершенных раундов
    if (round.status === 'crashed') {
      baseData.crashPoint = round.crashPoint.toNumber();
      baseData.serverSeed = round.serverSeed;
    }

    return baseData;
  }

  /**
   * ❌ ПРИВАТНАЯ конвертация для внутреннего использования
   * Возвращает ВСЕ данные включая serverSeed и crashPoint
   */
  private convertRoundDataFull(round: GameRound): RoundDataFull {
    return {
      id: round.id,
      crashPoint: round.crashPoint.toNumber(),
      serverSeed: round.serverSeed,
      hashedServerSeed: round.hashedServerSeed,
      status: round.status,
      houseFee: round.houseFee.toNumber(),
      startTime: round.startTime,
      endTime: round.endTime,
      createdAt: round.createdAt,
    };
  }

  /**
   * Конвертирует Prisma Bet в наш BetData тип
   */
  private convertBetData(bet: Bet): BetData {
    return {
      id: bet.id,
      chatId: bet.chatId,
      roundId: bet.roundId,
      amount: bet.amount.toString(),
      currency: bet.currency,
      cashoutAt: bet.cashoutAt ? bet.cashoutAt.toNumber() : null,
      cashedOut: bet.cashedOut,
      profit: bet.profit ? bet.profit.toString() : null,
      createdAt: bet.createdAt,
    };
  }
}

// Экспортируем singleton
export const gameService = new GameService();

