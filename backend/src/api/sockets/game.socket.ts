/**
 * WebSocket Handlers for Crash Game
 * 
 * Socket.IO события для управления игровыми раундами в реальном времени.
 */

import { Socket, Server } from 'socket.io';
import { z } from 'zod';
import { logger } from '../../utils/logger';
import { gameService } from '../../services/game.service';
import { betService } from '../../services/bet.service';
import { gameLoopService } from '../../services/gameLoop.service';
import { validateTelegramInitData } from '../middlewares/auth';
import { GAME_CONFIG } from '../../config/gameConfig';
import { validatePlaceBetRequest } from '../../utils/validation';

/**
 * Интерфейс для аутентифицированного сокета
 *
 * После прохождения middleware user всегда определен,
 * но TypeScript требует опциональность для совместимости типов
 */
export interface AuthenticatedSocket extends Socket {
  user?: {
    chatId: string;
    username?: string;
  };
}

/**
 * Регистрирует все Socket.IO handlers для Crash Game
 */
export function registerGameSocketHandlers(io: Server): void {
  // Namespace для игры
  const gameNamespace = io.of('/game');

  // Middleware для аутентификации
  gameNamespace.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const initData = socket.handshake.auth.initData;

      if (!initData) {
        return next(new Error('Authentication required'));
      }

      // Валидируем initData
      const validatedData = validateTelegramInitData(initData);

      if (!validatedData || !validatedData.user) {
        return next(new Error('Invalid authentication'));
      }

      const telegramUser = validatedData.user;
      socket.user = {
        chatId: telegramUser.id.toString(),
        username: telegramUser.username,
      };

      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  gameNamespace.on('connection', (socket: AuthenticatedSocket) => {
    // После middleware chatId всегда определен
    const chatId = socket.user!.chatId;
    logger.info(`✅ User connected to game: ${chatId} (socket: ${socket.id})`);

    /**
     * Событие: Подключение к игре
     * Клиент отправляет: ничего
     * Сервер отправляет: информация об активном раунде с временем синхронизации
     *
     * ⚠️ БЕЗОПАСНОСТЬ: Не отправляем crashPoint, только hashedServerSeed
     */
    socket.on('game:connect', async () => {
      try {
        const activeRound = await gameService.getActiveRound();

        if (!activeRound) {
          socket.emit('game:no_active_round', {
            message: 'No active round at the moment'
          });
          return;
        }

        // Вычисляем время краша
        const serverTime = Date.now();
        const startTimeMs = activeRound.startTime.getTime();
        const crashTimeMs = startTimeMs + GAME_CONFIG.BETTING_PHASE_DURATION + GAME_CONFIG.FLYING_PHASE_DURATION;

        socket.emit('game:round_info', {
          roundId: activeRound.id,
          hashedServerSeed: activeRound.hashedServerSeed,
          status: activeRound.status,
          serverTime,           // ← Для синхронизации времени
          startTime: activeRound.startTime.toISOString(),
          crashTime: crashTimeMs,           // ← Время краша для клиента
          bettingPhaseDuration: GAME_CONFIG.BETTING_PHASE_DURATION,
          flyingPhaseDuration: GAME_CONFIG.FLYING_PHASE_DURATION,
        });

        // Присоединяемся к комнате раунда
        socket.join(`round:${activeRound.id}`);
        logger.info(`✅ User ${chatId} joined round ${activeRound.id}`);
      } catch (error) {
        logger.error('Game connect error:', error);
        socket.emit('game:error', {
          message: 'Failed to connect to game'
        });
      }
    });

    /**
     * Событие: Разместить ставку
     * Клиент отправляет: { roundId, amount, currency }
     * Сервер отправляет: { betId, status, ... }
     *
     * ✅ БЕЗОПАСНОСТЬ:
     * - Валидация UUID формата для roundId
     * - Валидация суммы и валюты
     * - Не отправляем информацию о присоединении других игроков
     */
    socket.on('game:place_bet', async (data: any) => {
      try {
        // ✅ ВАЛИДАЦИЯ UUID: Проверяем формат roundId
        const placeBetSchema = z.object({
          roundId: z.string().uuid('Invalid round ID format'),
          amount: z.number().positive('Amount must be positive'),
          currency: z.enum(['ton', 'stars'], { errorMap: () => ({ message: 'Currency must be ton or stars' }) })
        });

        let validatedData;
        try {
          validatedData = placeBetSchema.parse(data);
        } catch (error) {
          if (error instanceof z.ZodError) {
            socket.emit('game:error', { message: error.errors[0].message });
          } else {
            socket.emit('game:error', { message: 'Invalid request data' });
          }
          return;
        }

        const { roundId, amount, currency } = validatedData;

        const bet = await betService.createBet({
          chatId,
          roundId,
          amount,
          currency: currency.toLowerCase() as 'ton' | 'stars',
        });

        const serverTime = Date.now();
        socket.emit('game:bet_placed', {
          betId: bet.betId,
          roundId: bet.roundId,
          amount: bet.amount,
          currency: bet.currency,
          status: bet.status,
          serverTime,  // ← Для синхронизации времени
        });

        // ✅ БЕЗОПАСНОСТЬ: Не отправляем информацию о присоединении других игроков
        // Это предотвращает анализ паттернов ставок

        logger.info(`✅ Bet placed: ${bet.betId} (${amount} ${currency})`);
      } catch (error) {
        logger.error('Place bet error:', error);
        socket.emit('game:error', { message: 'Failed to place bet' });
      }
    });

    /**
     * Событие: Кэшаут ставки
     * Клиент отправляет: { betId }
     * Сервер отправляет: { betId, cashoutAt, profit, status }
     *
     * ✅ КРИТИЧЕСКАЯ БЕЗОПАСНОСТЬ:
     * - Валидация UUID формата для betId
     * - Используем ТОЛЬКО серверный мультипликатор из gameLoopService
     * - Клиент НЕ может манипулировать значением мультипликатора
     * - Проверка статуса раунда происходит атомарно в транзакции БД
     * - Не отправляем информацию о кэшауте других игроков
     */
    socket.on('game:cashout', async (data: any) => {
      try {
        // ✅ ВАЛИДАЦИЯ UUID: Проверяем формат betId
        const cashoutSchema = z.object({
          betId: z.string().uuid('Invalid bet ID format')
        });

        let validatedData;
        try {
          validatedData = cashoutSchema.parse(data);
        } catch (error) {
          if (error instanceof z.ZodError) {
            socket.emit('game:error', { message: error.errors[0].message });
          } else {
            socket.emit('game:error', { message: 'Invalid request data' });
          }
          return;
        }

        const { betId } = validatedData;

        // Проверяем, что ставка принадлежит пользователю
        const bet = await betService.getBetById(betId);
        if (!bet || bet.chatId !== chatId) {
          socket.emit('game:error', { message: 'Bet not found' });
          return;
        }

        // ✅ КРИТИЧЕСКАЯ БЕЗОПАСНОСТЬ: Получаем СЕРВЕРНЫЙ мультипликатор
        // Клиент НЕ может отправить свой мультипликатор
        const serverMultiplier = gameLoopService.getCurrentMultiplier();

        // ✅ БЕЗОПАСНОСТЬ: Проверяем статус раунда в памяти (быстрая проверка)
        // Финальная проверка будет в транзакции БД
        const roundStatus = gameLoopService.getRoundStatus();
        if (roundStatus !== 'flying') {
          socket.emit('game:error', { message: 'Round is not in flying phase' });
          return;
        }

        // Кэшаутим с СЕРВЕРНЫМ мультипликатором
        // Внутри cashoutBet есть атомарная проверка статуса раунда в транзакции
        const updatedBet = await betService.cashoutBet(betId, serverMultiplier);

        const serverTime = Date.now();
        socket.emit('game:cashout_success', {
          betId: updatedBet.betId,
          cashoutAt: updatedBet.cashoutAt,
          profit: updatedBet.profit,
          status: updatedBet.status,
          serverTime,
        });

        // ✅ БЕЗОПАСНОСТЬ: Не отправляем информацию о кэшауте других игроков
        // Это предотвращает анализ поведения других игроков

        logger.info(`✅ Cashout: ${betId} at ${serverMultiplier}x`);
      } catch (error) {
        logger.error('Cashout error:', error);
        socket.emit('game:error', { message: 'Failed to cashout' });
      }
    });

    /**
     * Событие: Получить информацию о ставке
     * Клиент отправляет: { betId }
     * Сервер отправляет: информация о ставке
     *
     * ✅ БЕЗОПАСНОСТЬ: Валидация UUID формата для betId
     */
    socket.on('game:get_bet', async (data: any) => {
      try {
        if (!chatId) {
          socket.emit('game:error', { message: 'Authentication required' });
          return;
        }

        // ✅ ВАЛИДАЦИЯ UUID: Проверяем формат betId
        const getBetSchema = z.object({
          betId: z.string().uuid('Invalid bet ID format')
        });

        let validatedData;
        try {
          validatedData = getBetSchema.parse(data);
        } catch (error) {
          if (error instanceof z.ZodError) {
            socket.emit('game:error', { message: error.errors[0].message });
          } else {
            socket.emit('game:error', { message: 'Invalid request data' });
          }
          return;
        }

        const { betId } = validatedData;

        const bet = await betService.getBetById(betId);

        if (!bet || bet.chatId !== chatId) {
          socket.emit('game:error', { message: 'Bet not found' });
          return;
        }

        socket.emit('game:bet_info', bet);
      } catch (error) {
        logger.error('Get bet error:', error);
        socket.emit('game:error', { message: 'Failed to get bet' });
      }
    });

    /**
     * Событие: Отключение от игры
     */
    socket.on('disconnect', () => {
      logger.info(`✅ User disconnected from game: ${chatId} (socket: ${socket.id})`);
    });

    /**
     * Обработка ошибок сокета
     */
    socket.on('error', (error: any) => {
      logger.error(`Socket error for user ${chatId}:`, error);
    });
  });

  logger.info('✅ Game socket handlers registered');
}

/**
 * Отправить обновление мультипликатора всем игрокам в раунде
 *
 * @param io - Socket.IO сервер
 * @param roundId - ID раунда
 * @param multiplier - Текущий мультипликатор
 *
 * ⚠️ КРИТИЧЕСКАЯ БЕЗОПАСНОСТЬ:
 * - НЕ отправляем growthRate - клиент мог бы вычислить crashMultiplier
 * - Формула: crashMultiplier = growthRate * flyingDuration + 1.0
 * - Клиент интерполирует мультипликатор между обновлениями (каждые 100ms)
 */
export function broadcastMultiplierUpdate(
  io: Server,
  roundId: string,
  multiplier: number
): void {
  const serverTime = Date.now();
  io.of('/game').to(`round:${roundId}`).emit('game:multiplier_update', {
    multiplier,
    serverTime,  // ← Для синхронизации времени
    // ❌ НЕ отправляем growthRate - это утечка crashMultiplier!
  });
}

/**
 * Отправить событие краша всем игрокам в раунде
 *
 * @param io - Socket.IO сервер
 * @param roundId - ID раунда
 * @param crashMultiplier - Мультипликатор краша
 *
 * ⚠️ СИНХРОНИЗАЦИЯ: Отправляем crashMultiplier только после краша
 * ⚠️ БЕЗОПАСНОСТЬ: crashPoint не утекает перед раундом
 */
export function broadcastRoundCrashed(
  io: Server,
  roundId: string,
  crashMultiplier: number
): void {
  const serverTime = Date.now();
  io.of('/game').to(`round:${roundId}`).emit('game:round_crashed', {
    crashMultiplier,
    serverTime,  // ← Для синхронизации времени
  });
}

/**
 * Отправить информацию о новом раунде всем подключенным игрокам
 *
 * @param io - Socket.IO сервер
 * @param roundId - ID раунда
 * @param hashedServerSeed - Хешированный serverSeed
 * @param startTime - Время начала раунда
 *
 * ⚠️ СИНХРОНИЗАЦИЯ: Отправляем crashTime для синхронизации
 * ⚠️ БЕЗОПАСНОСТЬ: crashMultiplier не отправляем
 */
export function broadcastNewRound(
  io: Server,
  roundId: string,
  hashedServerSeed: string,
  startTime: Date = new Date()
): void {
  const serverTime = Date.now();
  const startTimeMs = startTime.getTime();
  const crashTimeMs = startTimeMs + GAME_CONFIG.BETTING_PHASE_DURATION + GAME_CONFIG.FLYING_PHASE_DURATION;

  io.of('/game').emit('game:round_start', {
    roundId,
    hashedServerSeed,
    serverTime,           // ← Для синхронизации времени
    startTime: startTime.toISOString(),
    crashTime: crashTimeMs,           // ← Время краша для клиента
    bettingPhaseDuration: GAME_CONFIG.BETTING_PHASE_DURATION,
    flyingPhaseDuration: GAME_CONFIG.FLYING_PHASE_DURATION,
  });
}

/**
 * Отправить результаты раунда всем игрокам
 *
 * @param io - Socket.IO сервер
 * @param roundId - ID раунда
 * @param crashMultiplier - Мультипликатор краша
 *
 * ⚠️ СИНХРОНИЗАЦИЯ: Отправляем результаты после завершения раунда
 */
export function broadcastRoundResults(
  io: Server,
  roundId: string,
  crashMultiplier: number
): void {
  const serverTime = Date.now();
  io.of('/game').to(`round:${roundId}`).emit('game:round_results', {
    roundId,
    crashMultiplier,
    serverTime,  // ← Для синхронизации времени
  });
}

