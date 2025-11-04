/**
 * Game Controller for Crash Game
 * 
 * REST API endpoints для управления игровыми раундами и ставками.
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { gameService } from '../../services/game.service';
import { betService } from '../../services/bet.service';
import { logger } from '../../utils/logger';
import { GAME_CONFIG } from '../../config/gameConfig';
import type { ApiResponse } from '../../../../shared/types/api';

/**
 * Создать новый раунд
 * POST /api/game/round/create
 *
 * БЕЗОПАСНОСТЬ: Не возвращаем serverSeed, только hashedServerSeed
 */
export const createRound = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const round = await gameService.createRound();

    const response: ApiResponse = {
      success: true,
      data: {
        roundId: round.id,
        hashedServerSeed: round.hashedServerSeed,
        status: round.status,
        startTime: round.startTime.toISOString(),
        bettingPhaseDuration: GAME_CONFIG.BETTING_PHASE_DURATION,
        flyingPhaseDuration: GAME_CONFIG.FLYING_PHASE_DURATION,
      }
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Create round API error:', error);
    // БЕЗОПАСНОСТЬ: Не возвращаем детали ошибки
    res.status(500).json({
      success: false,
      error: 'Failed to create round'
    } as ApiResponse);
  }
};

/**
 * Получить информацию о раунде
 * GET /api/game/round/:roundId
 *
 * БЕЗОПАСНОСТЬ: crashPoint возвращается ТОЛЬКО после завершения раунда
 */
export const getRound = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { roundId } = req.params;

    if (!roundId) {
      res.status(400).json({
        success: false,
        error: 'Invalid request'
      } as ApiResponse);
      return;
    }

    const round = await gameService.getRoundById(roundId);

    if (!round) {
      res.status(404).json({
        success: false,
        error: 'Round not found'
      } as ApiResponse);
      return;
    }

    // БЕЗОПАСНОСТЬ: crashPoint возвращаем ТОЛЬКО если раунд завершен
    const data: any = {
      roundId: round.id,
      status: round.status,
      startTime: round.startTime.toISOString(),
      endTime: round.endTime?.toISOString() || null,
      betsCount: round.betsCount || 0,
    };

    // Только для завершенных раундов возвращаем crashPoint
    if (round.status === 'crashed') {
      data.crashPoint = round.crashPoint;
    }

    const response: ApiResponse = {
      success: true,
      data
    };

    res.json(response);
  } catch (error) {
    logger.error('Get round API error:', error);
    // БЕЗОПАСНОСТЬ: Не возвращаем детали ошибки
    res.status(500).json({
      success: false,
      error: 'Failed to get round'
    } as ApiResponse);
  }
};

/**
 * Получить активный раунд
 * GET /api/game/round/active
 */
export const getActiveRound = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const round = await gameService.getActiveRound();

    if (!round) {
      res.status(404).json({
        success: false,
        error: 'No active round'
      } as ApiResponse);
      return;
    }

    const response: ApiResponse = {
      success: true,
      data: {
        roundId: round.id,
        hashedServerSeed: round.hashedServerSeed,
        status: round.status,
        startTime: round.startTime.toISOString(),
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Get active round API error:', error);
    // БЕЗОПАСНОСТЬ: Не возвращаем детали ошибки
    res.status(500).json({
      success: false,
      error: 'Failed to get active round'
    } as ApiResponse);
  }
};

/**
 * Разместить ставку
 * POST /api/game/bet/place
 */
export const placeBet = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const chatId = req.user?.chatId;
    const { roundId, amount, currency } = req.body;

    if (!chatId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as ApiResponse);
      return;
    }

    if (!roundId || !amount || !currency) {
      res.status(400).json({
        success: false,
        error: 'Round ID, amount, and currency are required'
      } as ApiResponse);
      return;
    }

    const bet = await betService.createBet({
      chatId,
      roundId,
      amount,
      currency: currency.toLowerCase(),
    });

    const response: ApiResponse = {
      success: true,
      data: {
        betId: bet.betId,
        roundId: bet.roundId,
        amount: bet.amount,
        currency: bet.currency,
        status: bet.status,
      }
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Place bet API error:', error);
    // БЕЗОПАСНОСТЬ: Не возвращаем детали ошибки
    res.status(400).json({
      success: false,
      error: 'Failed to place bet'
    } as ApiResponse);
  }
};

/**
 * Кэшаут ставки
 * POST /api/game/bet/cashout
 *
 * КРИТИЧЕСКАЯ БЕЗОПАСНОСТЬ:
 * - Использует ТОЛЬКО серверный мультипликатор из gameLoopService
 * - Клиент НЕ может отправить свой мультипликатор
 */
export const cashoutBet = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const chatId = req.user?.chatId;
    const { betId } = req.body;

    if (!chatId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as ApiResponse);
      return;
    }

    if (!betId) {
      res.status(400).json({
        success: false,
        error: 'Bet ID is required'
      } as ApiResponse);
      return;
    }

    // Проверяем, что ставка принадлежит пользователю
    const bet = await betService.getBetById(betId);
    if (!bet || bet.chatId !== chatId) {
      res.status(403).json({
        success: false,
        error: 'Bet not found or access denied'
      } as ApiResponse);
      return;
    }

    // КРИТИЧЕСКАЯ БЕЗОПАСНОСТЬ: Получаем СЕРВЕРНЫЙ мультипликатор
    // Импортируем gameLoopService в начале файла
    const { gameLoopService } = await import('../../services/gameLoop.service');
    const serverMultiplier = gameLoopService.getCurrentMultiplier();

    // Проверяем статус раунда
    const roundStatus = gameLoopService.getRoundStatus();
    if (roundStatus !== 'flying') {
      res.status(400).json({
        success: false,
        error: 'Round is not in flying phase'
      } as ApiResponse);
      return;
    }

    const updatedBet = await betService.cashoutBet(betId, serverMultiplier);

    const response: ApiResponse = {
      success: true,
      data: {
        betId: updatedBet.betId,
        cashoutAt: updatedBet.cashoutAt,
        profit: updatedBet.profit,
        status: updatedBet.status,
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Cashout bet API error:', error);
    // БЕЗОПАСНОСТЬ: Не возвращаем детали ошибки
    res.status(400).json({
      success: false,
      error: 'Failed to cashout bet'
    } as ApiResponse);
  }
};

/**
 * Получить информацию о ставке
 * GET /api/game/bet/:betId
 */
export const getBet = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const chatId = req.user?.chatId;
    const { betId } = req.params;

    if (!chatId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as ApiResponse);
      return;
    }

    if (!betId) {
      res.status(400).json({
        success: false,
        error: 'Bet ID is required'
      } as ApiResponse);
      return;
    }

    const bet = await betService.getBetById(betId);

    if (!bet || bet.chatId !== chatId) {
      res.status(404).json({
        success: false,
        error: 'Bet not found'
      } as ApiResponse);
      return;
    }

    const response: ApiResponse = {
      success: true,
      data: bet
    };

    res.json(response);
  } catch (error) {
    logger.error('Get bet API error:', error);
    // БЕЗОПАСНОСТЬ: Не возвращаем детали ошибки
    res.status(500).json({
      success: false,
      error: 'Failed to get bet'
    } as ApiResponse);
  }
};

/**
 * Получить ставки пользователя в раунде
 * GET /api/game/round/:roundId/bets
 *
 * БЕЗОПАСНОСТЬ: Возвращаем ТОЛЬКО ставки текущего пользователя
 */
export const getRoundBets = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const chatId = req.user?.chatId;
    const { roundId } = req.params;

    if (!chatId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as ApiResponse);
      return;
    }

    if (!roundId) {
      res.status(400).json({
        success: false,
        error: 'Invalid request'
      } as ApiResponse);
      return;
    }

    // БЕЗОПАСНОСТЬ: Получаем ТОЛЬКО ставки текущего пользователя
    const bets = await gameService.getUserBetsInRound(chatId, roundId);

    const response: ApiResponse = {
      success: true,
      data: {
        roundId,
        bets,
        totalBets: bets.length,
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Get round bets API error:', error);
    // БЕЗОПАСНОСТЬ: Не возвращаем детали ошибки
    res.status(500).json({
      success: false,
      error: 'Failed to get bets'
    } as ApiResponse);
  }
};

