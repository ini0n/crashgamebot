/**
 * Game Configuration for Crash Game
 * 
 * Все параметры игры Crash Game в одном месте.
 * Легко менять, легко тестировать.
 */

import { config } from './config';

/**
 * Основная конфигурация игры
 */
export const GAME_CONFIG = {
  // ============================================
  // МУЛЬТИПЛИКАТОРЫ
  // ============================================
  
  /** Минимальный мультипликатор (всегда 1.0x) */
  MIN_MULTIPLIER: 1.0,
  
  /** Максимальный мультипликатор (настраивается!) */
  MAX_MULTIPLIER: parseFloat(process.env.GAME_MAX_MULTIPLIER || '100.0'),
  
  // ============================================
  // ВРЕМЕННЫЕ ПАРАМЕТРЫ (в миллисекундах)
  // ============================================
  
  /** Длительность фазы ставок (10 сек) */
  BETTING_PHASE_DURATION: 10000,
  
  /** Длительность фазы полета (20 сек) */
  FLYING_PHASE_DURATION: 20000,
  
  /** Общая длительность раунда (30 сек) */
  TOTAL_ROUND_DURATION: 30000,
  
  /** Интервал обновления мультипликатора (100ms = 10 обновлений в сек) */
  MULTIPLIER_UPDATE_INTERVAL: 100,
  
  // ============================================
  // RTP И ВЕРОЯТНОСТИ
  // ============================================
  
  /** Целевой RTP (Return To Player) - 95% */
  TARGET_RTP: 0.95,
  
  // ============================================
  // СТАВКИ
  // ============================================
  
  /** Минимальная ставка в TON */
  MIN_BET_TON: parseFloat(process.env.MIN_BET_TON || '0.1'),
  
  /** Максимальная ставка в TON */
  MAX_BET_TON: parseFloat(process.env.GAME_MAX_BET_TON || '100.0'),
  
  /** Минимальная ставка в Stars */
  MIN_BET_STARS: parseInt(process.env.MIN_BET_STARS || '10'),
  
  /** Максимальная ставка в Stars */
  MAX_BET_STARS: parseInt(process.env.GAME_MAX_BET_STARS || '1000'),
  
  // ============================================
  // КОМИССИЯ ДОМА (House Fee)
  // ============================================
  
  /** Комиссия дома (1% по умолчанию) */
  HOUSE_FEE: parseFloat(process.env.HOUSE_FEE || '0.01'),
  
  // ============================================
  // ДИНАМИЧЕСКИЙ МАКСИМУМ (опционально)
  // ============================================
  
  /** Включить динамический максимум мультипликатора */
  ENABLE_DYNAMIC_MAX: process.env.GAME_ENABLE_DYNAMIC_MAX === 'true',
  
  /** Цикл динамического максимума (в днях) */
  DYNAMIC_MAX_CYCLE_DAYS: parseInt(process.env.GAME_DYNAMIC_MAX_CYCLE_DAYS || '20'),
  
  /** Минимальное значение динамического максимума */
  DYNAMIC_MAX_MIN: parseFloat(process.env.GAME_DYNAMIC_MAX_MIN || '50.0'),
  
  /** Максимальное значение динамического максимума */
  DYNAMIC_MAX_MAX: parseFloat(process.env.GAME_DYNAMIC_MAX_MAX || '150.0'),
};

/**
 * Валидация конфига при загрузке
 */
export function validateGameConfig(): void {
  const errors: string[] = [];

  // Проверка мультипликаторов
  if (GAME_CONFIG.MIN_MULTIPLIER < 1.0) {
    errors.push('MIN_MULTIPLIER должен быть >= 1.0');
  }

  if (GAME_CONFIG.MAX_MULTIPLIER <= GAME_CONFIG.MIN_MULTIPLIER) {
    errors.push('MAX_MULTIPLIER должен быть > MIN_MULTIPLIER');
  }

  // Проверка временных параметров
  if (GAME_CONFIG.BETTING_PHASE_DURATION <= 0) {
    errors.push('BETTING_PHASE_DURATION должен быть > 0');
  }

  if (GAME_CONFIG.FLYING_PHASE_DURATION <= 0) {
    errors.push('FLYING_PHASE_DURATION должен быть > 0');
  }

  if (GAME_CONFIG.MULTIPLIER_UPDATE_INTERVAL <= 0) {
    errors.push('MULTIPLIER_UPDATE_INTERVAL должен быть > 0');
  }

  // Проверка RTP
  if (GAME_CONFIG.TARGET_RTP <= 0 || GAME_CONFIG.TARGET_RTP > 1) {
    errors.push('TARGET_RTP должен быть между 0 и 1');
  }

  // Проверка ставок
  if (GAME_CONFIG.MIN_BET_TON <= 0) {
    errors.push('MIN_BET_TON должен быть > 0');
  }

  if (GAME_CONFIG.MAX_BET_TON <= GAME_CONFIG.MIN_BET_TON) {
    errors.push('MAX_BET_TON должен быть > MIN_BET_TON');
  }

  if (GAME_CONFIG.MIN_BET_STARS <= 0) {
    errors.push('MIN_BET_STARS должен быть > 0');
  }

  if (GAME_CONFIG.MAX_BET_STARS <= GAME_CONFIG.MIN_BET_STARS) {
    errors.push('MAX_BET_STARS должен быть > MIN_BET_STARS');
  }

  // Проверка комиссии
  if (GAME_CONFIG.HOUSE_FEE < 0 || GAME_CONFIG.HOUSE_FEE > 1) {
    errors.push('HOUSE_FEE должен быть между 0 и 1');
  }

  // Проверка динамического максимума
  if (GAME_CONFIG.ENABLE_DYNAMIC_MAX) {
    if (GAME_CONFIG.DYNAMIC_MAX_CYCLE_DAYS <= 0) {
      errors.push('DYNAMIC_MAX_CYCLE_DAYS должен быть > 0');
    }

    if (GAME_CONFIG.DYNAMIC_MAX_MIN <= 0) {
      errors.push('DYNAMIC_MAX_MIN должен быть > 0');
    }

    if (GAME_CONFIG.DYNAMIC_MAX_MAX <= GAME_CONFIG.DYNAMIC_MAX_MIN) {
      errors.push('DYNAMIC_MAX_MAX должен быть > DYNAMIC_MAX_MIN');
    }
  }

  // Если есть ошибки - выбросить исключение
  if (errors.length > 0) {
    throw new Error(`Game Config Validation Error:\n${errors.join('\n')}`);
  }
}

/**
 * Получить максимальный мультипликатор
 * 
 * Если динамический максимум отключен - возвращает фиксированное значение
 * Если включен - возвращает значение, которое растет по дням
 */
export function getMaxMultiplier(): number {
  if (!GAME_CONFIG.ENABLE_DYNAMIC_MAX) {
    return GAME_CONFIG.MAX_MULTIPLIER;
  }

  // Динамический максимум: растет по дням в цикле
  const day = Math.floor(Date.now() / 86400000); // Дни с 1970 года
  const cycle = day % GAME_CONFIG.DYNAMIC_MAX_CYCLE_DAYS;
  const progress = cycle / GAME_CONFIG.DYNAMIC_MAX_CYCLE_DAYS;
  const range = GAME_CONFIG.DYNAMIC_MAX_MAX - GAME_CONFIG.DYNAMIC_MAX_MIN;

  return GAME_CONFIG.DYNAMIC_MAX_MIN + progress * range;
}



