/**
 * Game Algorithm for Crash Game
 * 
 * Основной алгоритм генерации мультипликатора с применением конфига.
 * Объединяет Provably Fair систему с MAX_MULTIPLIER.
 */

import { GAME_CONFIG, getMaxMultiplier } from '../config/gameConfig';
import {
  calculateHash,
  hashToNormalized,
  normalizedToMultiplier,
} from './provablyFair';

/**
 * Генерирует мультипликатор краша с применением MAX_MULTIPLIER
 *
 * Полный алгоритм:
 * 1. Генерируем хеш из serverSeed + clientSeed
 * 2. Нормализуем хеш в диапазон 0-1
 * 3. Применяем экспоненциальное распределение: multiplier = 1 / (1 - normalized)
 * 4. Применяем MAX_MULTIPLIER (ограничиваем сверху)
 * 5. Применяем MIN_MULTIPLIER (ограничиваем снизу)
 *
 * Результат: непрерывный диапазон мультипликаторов (1.0 - MAX_MULTIPLIER)
 *
 * @param serverSeed - Seed от сервера
 * @param clientSeed - Seed от клиента (опционально)
 * @returns Мультипликатор краша (например, 1.23, 2.45, 5.67, 100.0)
 */
export function generateCrashMultiplier(
  serverSeed: string,
  clientSeed?: string
): number {
  // Если clientSeed не предоставлен, используем пустую строку
  const finalClientSeed = clientSeed || '';

  // 1. Генерируем хеш
  const hash = calculateHash(serverSeed, finalClientSeed);

  // 2. Нормализуем (0-1)
  const normalized = hashToNormalized(hash);

  // 3. Применяем RTP распределение
  let multiplier = normalizedToMultiplier(normalized);

  // 4. Применяем максимум из конфига
  const maxMult = getMaxMultiplier();
  multiplier = Math.min(multiplier, maxMult);

  // 5. Применяем минимум
  multiplier = Math.max(multiplier, GAME_CONFIG.MIN_MULTIPLIER);

  return multiplier;
}

/**
 * Генерирует мультипликатор с точностью до 2 знаков после запятой
 * 
 * @param serverSeed - Seed от сервера
 * @param clientSeed - Seed от клиента (опционально)
 * @returns Мультипликатор (например, 1.23, 5.67, 100.0)
 */
export function generateCrashMultiplierRounded(
  serverSeed: string,
  clientSeed?: string
): number {
  const multiplier = generateCrashMultiplier(serverSeed, clientSeed);
  
  // Округляем до 2 знаков после запятой
  return Math.round(multiplier * 100) / 100;
}

/**
 * Проверяет, валидна ли ставка
 * 
 * @param amount - Сумма ставки
 * @param currency - Валюта ('TON' или 'STARS')
 * @returns true если ставка валидна, false иначе
 */
export function isValidBetAmount(amount: number, currency: 'TON' | 'STARS'): boolean {
  if (currency === 'TON') {
    return amount >= GAME_CONFIG.MIN_BET_TON && amount <= GAME_CONFIG.MAX_BET_TON;
  } else if (currency === 'STARS') {
    return amount >= GAME_CONFIG.MIN_BET_STARS && amount <= GAME_CONFIG.MAX_BET_STARS;
  }
  
  return false;
}



/**
 * Вычисляет выигрыш
 * 
 * Выигрыш = ставка × мультипликатор - комиссия дома
 * 
 * @param betAmount - Сумма ставки
 * @param multiplier - Мультипликатор, на котором кэшаутил игрок
 * @returns Выигрыш (может быть отрицательным, если игрок проиграл)
 */
export function calculateWinnings(betAmount: number, multiplier: number): number {
  // Если мультипликатор меньше 1.0, игрок проиграл
  if (multiplier < GAME_CONFIG.MIN_MULTIPLIER) {
    return -betAmount;
  }

  // Выигрыш = ставка × мультипликатор
  const grossWinnings = betAmount * multiplier;

  // Вычитаем комиссию дома
  const houseFeeAmount = grossWinnings * GAME_CONFIG.HOUSE_FEE;
  const netWinnings = grossWinnings - houseFeeAmount;

  // Возвращаем прибыль (выигрыш минус исходная ставка)
  return netWinnings - betAmount;
}

/**
 * Вычисляет выигрыш с учетом краша
 * 
 * Если игрок не кэшаутил до краша - он теряет ставку.
 * Если кэшаутил - получает выигрыш.
 * 
 * @param betAmount - Сумма ставки
 * @param playerCashoutMultiplier - Мультипликатор, на котором кэшаутил игрок (или undefined если не кэшаутил)
 * @param crashMultiplier - Мультипликатор краша
 * @returns Выигрыш (может быть отрицательным)
 */
export function calculateFinalWinnings(
  betAmount: number,
  playerCashoutMultiplier: number | undefined,
  crashMultiplier: number
): number {
  // Если игрок не кэшаутил
  if (playerCashoutMultiplier === undefined) {
    // Если краш произошел - игрок теряет ставку
    return -betAmount;
  }

  // Если игрок кэшаутил после краша - он теряет ставку
  if (playerCashoutMultiplier > crashMultiplier) {
    return -betAmount;
  }

  // Если игрок кэшаутил до краша - он выигрывает
  return calculateWinnings(betAmount, playerCashoutMultiplier);
}



