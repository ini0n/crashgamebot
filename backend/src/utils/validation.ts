/**
 * Validation Utilities for Crash Game
 * 
 * Централизованные функции валидации для устранения дублирования кода.
 */

import { GAME_CONFIG } from '../config/gameConfig';

/**
 * Интерфейс для результата валидации
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Валидация данных для размещения ставки
 * 
 * @param data - Данные запроса
 * @returns Результат валидации
 */
export function validatePlaceBetRequest(data: any): ValidationResult {
  const { roundId, amount, currency } = data;

  if (!roundId) {
    return { valid: false, error: 'Round ID is required' };
  }

  if (!amount) {
    return { valid: false, error: 'Amount is required' };
  }

  if (!currency) {
    return { valid: false, error: 'Currency is required' };
  }

  return { valid: true };
}

/**
 * Валидация данных для кэшаута
 * 
 * @param data - Данные запроса
 * @returns Результат валидации
 */
export function validateCashoutRequest(data: any): ValidationResult {
  const { betId, multiplier } = data;

  if (!betId) {
    return { valid: false, error: 'Bet ID is required' };
  }

  if (multiplier === undefined) {
    return { valid: false, error: 'Multiplier is required' };
  }

  // Валидация диапазона мультипликатора
  if (multiplier < 1.0 || multiplier > 1000.0) {
    return { valid: false, error: 'Invalid multiplier' };
  }

  return { valid: true };
}

/**
 * Валидация временного окна для кэшаута
 * 
 * @param clientTime - Время на клиенте
 * @param maxDiffMs - Максимальная разница в миллисекундах (по умолчанию 5 секунд)
 * @returns Результат валидации
 */
export function validateTimeWindow(clientTime: number, maxDiffMs: number = 5000): ValidationResult {
  if (clientTime === undefined) {
    return { valid: false, error: 'Client time is required' };
  }

  const serverTime = Date.now();
  const timeDiff = Math.abs(serverTime - clientTime);

  if (timeDiff > maxDiffMs) {
    return { valid: false, error: 'Request timeout' };
  }

  return { valid: true };
}

/**
 * Валидация суммы ставки
 * 
 * @param amount - Сумма ставки
 * @param currency - Валюта ('TON' или 'STARS')
 * @returns Результат валидации с сообщением об ошибке
 */
export function validateBetAmount(amount: number, currency: 'TON' | 'STARS'): ValidationResult {
  if (currency === 'TON') {
    if (amount < GAME_CONFIG.MIN_BET_TON) {
      return { 
        valid: false, 
        error: `Minimum bet: ${GAME_CONFIG.MIN_BET_TON} TON` 
      };
    }
    if (amount > GAME_CONFIG.MAX_BET_TON) {
      return { 
        valid: false, 
        error: `Maximum bet: ${GAME_CONFIG.MAX_BET_TON} TON` 
      };
    }
  } else if (currency === 'STARS') {
    if (amount < GAME_CONFIG.MIN_BET_STARS) {
      return { 
        valid: false, 
        error: `Minimum bet: ${GAME_CONFIG.MIN_BET_STARS} Stars` 
      };
    }
    if (amount > GAME_CONFIG.MAX_BET_STARS) {
      return { 
        valid: false, 
        error: `Maximum bet: ${GAME_CONFIG.MAX_BET_STARS} Stars` 
      };
    }
  }

  return { valid: true };
}

