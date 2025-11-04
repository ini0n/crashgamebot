/**
 * Game Loop Service for Crash Game
 * 
 * Управление игровым циклом:
 * - Автоматическое создание раундов
 * - Управление фазами (betting → flying → crashed)
 * - Обновление мультипликатора каждые 100ms
 * - Завершение раунда и расчет результатов
 * - Broadcast событий через Socket.IO
 */

import { Server } from 'socket.io';
import { logger } from '../utils/logger';
import { gameService } from './game.service';
import { betService } from './bet.service';
import { GAME_CONFIG } from '../config/gameConfig';
import {
  broadcastMultiplierUpdate,
  broadcastNewRound,
  broadcastRoundCrashed,
  broadcastRoundResults,
} from '../api/sockets/game.socket';

/**
 * Интерфейс для состояния игрового цикла
 */
export interface GameLoopState {
  isRunning: boolean;
  currentRoundId: string | null;
  currentMultiplier: number;
  growthRate: number;
  startTime: number;
  crashTime: number;
  crashMultiplier: number;
  status: 'betting' | 'flying' | 'crashed';
}

/**
 * Game Loop Service - управляет игровым циклом
 */
class GameLoopService {
  private io: Server | null = null;
  private state: GameLoopState = {
    isRunning: false,
    currentRoundId: null,
    currentMultiplier: 1.0,
    growthRate: 0.01,
    startTime: 0,
    crashTime: 0,
    crashMultiplier: 1.0,
    status: 'betting',
  };

  private multiplierIntervalId: NodeJS.Timeout | null = null;
  private roundIntervalId: NodeJS.Timeout | null = null;

  /**
   * Получить текущий мультипликатор
   * Используется для валидации кэшаута
   */
  public getCurrentMultiplier(): number {
    return this.state.currentMultiplier;
  }

  /**
   * Получить статус раунда
   */
  public getRoundStatus(): 'betting' | 'flying' | 'crashed' {
    return this.state.status;
  }

  /**
   * Получить ID текущего раунда
   */
  public getCurrentRoundId(): string | null {
    return this.state.currentRoundId;
  }

  /**
   * Инициализация Game Loop Service
   */
  public async initialize(io: Server): Promise<void> {
    try {
      this.io = io;
      logger.info('Game Loop Service initialized');
    } catch (error) {
      logger.error('Error initializing Game Loop Service:', error);
      throw error;
    }
  }

  /**
   * Запустить игровой цикл
   */
  public async start(): Promise<void> {
    try {
      if (this.state.isRunning) {
        logger.warn('Game loop is already running');
        return;
      }

      this.state.isRunning = true;
      logger.info('🎮 Game loop started');

      // Запускаем первый раунд
      await this.createNewRound();
    } catch (error) {
      logger.error('Error starting game loop:', error);
      this.state.isRunning = false;
      throw error;
    }
  }

  /**
   * Остановить игровой цикл
   */
  public async stop(): Promise<void> {
    try {
      this.state.isRunning = false;

      if (this.multiplierIntervalId) {
        clearInterval(this.multiplierIntervalId);
        this.multiplierIntervalId = null;
      }

      if (this.roundIntervalId) {
        clearTimeout(this.roundIntervalId);
        this.roundIntervalId = null;
      }

      logger.info('🛑 Game loop stopped');
    } catch (error) {
      logger.error('Error stopping game loop:', error);
      throw error;
    }
  }

  /**
   * Создать новый раунд
   */
  private async createNewRound(): Promise<void> {
    try {
      // Создаем раунд в БД
      const round = await gameService.createRound();
      this.state.currentRoundId = round.id;
      this.state.crashMultiplier = round.crashPoint;
      this.state.status = 'betting';
      this.state.currentMultiplier = 1.0;
      this.state.startTime = Date.now();
      this.state.crashTime = this.state.startTime + GAME_CONFIG.TOTAL_ROUND_DURATION;

      // Вычисляем скорость роста мультипликатора
      // crashMultiplier должен быть достигнут за FLYING_PHASE_DURATION
      const flyingDuration = GAME_CONFIG.FLYING_PHASE_DURATION / 1000; // в секундах
      this.state.growthRate = (this.state.crashMultiplier - 1.0) / flyingDuration;

      logger.info(
        `New round created: ${round.id} (crash: ${round.crashPoint.toFixed(2)}x)`
      );

      // Отправляем информацию о новом раунде всем игрокам
      if (this.io) {
        broadcastNewRound(
          this.io,
          round.id,
          round.hashedServerSeed,
          new Date(this.state.startTime)
        );
      }

      // Запускаем фазу ставок
      this.startBettingPhase();
    } catch (error) {
      logger.error('Error creating new round:', error);
      throw error;
    }
  }

  /**
   * Запустить фазу ставок
   */
  private startBettingPhase(): void {
    try {
      logger.info(`📊 Betting phase started for round ${this.state.currentRoundId}`);

      // Через BETTING_PHASE_DURATION переходим в фазу полета
      this.roundIntervalId = setTimeout(() => {
        this.startFlyingPhase();
      }, GAME_CONFIG.BETTING_PHASE_DURATION);

      // Планируем следующий раунд после полного цикла (betting + flying + pause)
      const totalCycleDuration = GAME_CONFIG.BETTING_PHASE_DURATION +
                                 GAME_CONFIG.FLYING_PHASE_DURATION +
                                 3000; // 3 сек пауза

      setTimeout(() => {
        if (this.state.isRunning) {
          this.scheduleNextRound();
        }
      }, totalCycleDuration);
    } catch (error) {
      logger.error('Error starting betting phase:', error);
    }
  }

  /**
   * Запустить фазу полета (мультипликатор растет)
   */
  private startFlyingPhase(): void {
    try {
      this.state.status = 'flying';
      logger.info(`🚀 Flying phase started for round ${this.state.currentRoundId}`);

      // Обновляем статус раунда в БД
      gameService.updateRoundStatus(this.state.currentRoundId!, 'flying').catch(error => {
        logger.error('Error updating round status to flying:', error);
      });

      // Запускаем обновление мультипликатора каждые 100ms
      this.multiplierIntervalId = setInterval(() => {
        this.updateMultiplier();
      }, GAME_CONFIG.MULTIPLIER_UPDATE_INTERVAL);

      // Через FLYING_PHASE_DURATION раунд крашится
      this.roundIntervalId = setTimeout(() => {
        this.crashRound();
      }, GAME_CONFIG.FLYING_PHASE_DURATION);
    } catch (error) {
      logger.error('Error starting flying phase:', error);
    }
  }

  /**
   * Обновить мультипликатор
   */
  private updateMultiplier(): void {
    try {
      const elapsed = Date.now() - this.state.startTime - GAME_CONFIG.BETTING_PHASE_DURATION;
      const elapsedSeconds = elapsed / 1000;

      // Вычисляем текущий мультипликатор
      this.state.currentMultiplier = 1.0 + this.state.growthRate * elapsedSeconds;

      // Если достигли crashMultiplier - крашимся
      if (this.state.currentMultiplier >= this.state.crashMultiplier) {
        this.state.currentMultiplier = this.state.crashMultiplier;
        this.crashRound();
        return;
      }

      // Отправляем обновление мультипликатора
      // БЕЗОПАСНОСТЬ: НЕ отправляем growthRate - это утечка crashMultiplier
      if (this.io) {
        broadcastMultiplierUpdate(
          this.io,
          this.state.currentRoundId!,
          this.state.currentMultiplier
        );
      }
    } catch (error) {
      logger.error('Error updating multiplier:', error);
    }
  }

  /**
   * Краш раунда
   */
  private async crashRound(): Promise<void> {
    try {
      if (this.state.status === 'crashed') {
        return; // Уже крашнулись
      }

      this.state.status = 'crashed';

      // Останавливаем обновление мультипликатора
      if (this.multiplierIntervalId) {
        clearInterval(this.multiplierIntervalId);
        this.multiplierIntervalId = null;
      }

      logger.info(
        `💥 Round crashed: ${this.state.currentRoundId} at ${this.state.currentMultiplier.toFixed(2)}x`
      );

      // Обновляем статус раунда в БД
      await gameService.updateRoundStatus(this.state.currentRoundId!, 'crashed');

      // Отправляем событие краша
      if (this.io) {
        broadcastRoundCrashed(
          this.io,
          this.state.currentRoundId!,
          this.state.currentMultiplier
        );
      }

      // Финализируем все ставки в раунде
      await this.finalizeBets();

      // Отправляем результаты раунда
      if (this.io) {
        broadcastRoundResults(
          this.io,
          this.state.currentRoundId!,
          this.state.currentMultiplier
        );
      }

      // Следующий раунд будет запланирован из startBettingPhase()
    } catch (error) {
      logger.error('Error crashing round:', error);
    }
  }

  /**
   * Финализировать все ставки в раунде
   *
   * ОПТИМИЗАЦИЯ: Используем batch update вместо цикла
   * До: N запросов (findUnique + update для каждой ставки)
   * После: 1 запрос (updateMany)
   */
  private async finalizeBets(): Promise<void> {
    try {
      // Batch update всех не кэшаутнутых ставок в раунде
      // Игроки, которые не кэшаутили, теряют ставку (profit = -amount)
      const result = await betService.finalizeBetsInRound(
        this.state.currentRoundId!,
        this.state.currentMultiplier
      );

      logger.info(`Finalized ${result.count} bets for round ${this.state.currentRoundId}`);
    } catch (error) {
      logger.error('Error finalizing bets:', error);
    }
  }

  /**
   * Создать следующий раунд
   */
  private async scheduleNextRound(): Promise<void> {
    try {
      if (this.state.isRunning) {
        await this.createNewRound();
      }
    } catch (error) {
      logger.error('Error creating next round, retrying in 5 seconds:', error);
      // Повторная попытка через 5 секунд
      setTimeout(() => {
        if (this.state.isRunning) {
          this.scheduleNextRound();
        }
      }, 5000);
    }
  }

  /**
   * ПРИВАТНЫЙ метод - возвращает ПОЛНЫЙ state включая crashMultiplier
   * НЕ ИСПОЛЬЗОВАТЬ для API endpoints!
   */
  private getState(): GameLoopState {
    return { ...this.state };
  }

  /**
   * БЕЗОПАСНЫЙ метод для клиента - возвращает только безопасные данные
   * Используйте этот метод для API endpoints
   *
   * БЕЗОПАСНОСТЬ: НЕ возвращаем growthRate - клиент мог бы вычислить crashMultiplier
   */
  public getSafeState(): {
    isRunning: boolean;
    currentRoundId: string | null;
    currentMultiplier: number;
    status: 'betting' | 'flying' | 'crashed';
  } {
    return {
      isRunning: this.state.isRunning,
      currentRoundId: this.state.currentRoundId,
      currentMultiplier: this.state.currentMultiplier,
      status: this.state.status,
      // НЕ возвращаем: crashMultiplier, crashTime, startTime, growthRate
    };
  }

  /**
   * Получить БЕЗОПАСНУЮ информацию о текущем раунде для клиента
   *
   * БЕЗОПАСНОСТЬ: НЕ возвращает crashPoint, crashMultiplier, serverSeed, growthRate
   */
  public async getCurrentRoundInfo(): Promise<any> {
    try {
      if (!this.state.currentRoundId) {
        return null;
      }

      const round = await gameService.getRoundById(this.state.currentRoundId);

      // БЕЗОПАСНОСТЬ: Возвращаем ТОЛЬКО безопасные данные
      return {
        roundId: round?.id,
        hashedServerSeed: round?.hashedServerSeed,
        status: this.state.status,
        currentMultiplier: this.state.currentMultiplier,
        startTime: round?.startTime,
        // НЕ возвращаем: crashPoint, crashMultiplier, crashTime, serverSeed, growthRate
      };
    } catch (error) {
      logger.error('Error getting current round info:', error);
      return null;
    }
  }
}

// Экспортируем singleton
export const gameLoopService = new GameLoopService();

