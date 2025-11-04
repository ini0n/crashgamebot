/**
 * Game Routes for Crash Game
 * 
 * REST API endpoints для управления игровыми раундами и ставками.
 */

import { Router } from 'express';
import {
  createRound,
  getRound,
  getActiveRound,
  placeBet,
  cashoutBet,
  getBet,
  getRoundBets,
} from '../controllers/game.controller';
import { authenticateRequest } from '../middlewares/auth';

const router = Router();

// Все роуты требуют аутентификации
router.use(authenticateRequest);

/**
 * @route POST /api/game/round/create
 * @desc Создать новый раунд игры
 * @access Private
 * @returns { roundId, hashedServerSeed, status, startTime, bettingPhaseDuration, flyingPhaseDuration }
 */
router.post('/round/create', createRound);

/**
 * @route GET /api/game/round/active
 * @desc Получить активный раунд (betting или flying)
 * @access Private
 * @returns { roundId, hashedServerSeed, status, startTime }
 */
router.get('/round/active', getActiveRound);

/**
 * @route GET /api/game/round/:roundId
 * @desc Получить информацию о раунде
 * @access Private
 * @param roundId - ID раунда
 * @returns { roundId, crashPoint, status, startTime, endTime, betsCount, totalBetAmount }
 */
router.get('/round/:roundId', getRound);

/**
 * @route GET /api/game/round/:roundId/bets
 * @desc Получить все ставки в раунде
 * @access Private
 * @param roundId - ID раунда
 * @returns { roundId, bets[], totalBets }
 */
router.get('/round/:roundId/bets', getRoundBets);

/**
 * @route POST /api/game/bet/place
 * @desc Разместить ставку на раунд
 * @access Private
 * @body { roundId, amount, currency }
 * @returns { betId, roundId, amount, currency, status }
 */
router.post('/bet/place', placeBet);

/**
 * @route POST /api/game/bet/cashout
 * @desc Кэшаут ставки (вывести выигрыш)
 * @access Private
 * @body { betId, multiplier }
 * @returns { betId, cashoutAt, profit, status }
 */
router.post('/bet/cashout', cashoutBet);

/**
 * @route GET /api/game/bet/:betId
 * @desc Получить информацию о ставке
 * @access Private
 * @param betId - ID ставки
 * @returns { betId, chatId, roundId, amount, currency, cashoutAt, cashedOut, profit, status }
 */
router.get('/bet/:betId', getBet);

export default router;

