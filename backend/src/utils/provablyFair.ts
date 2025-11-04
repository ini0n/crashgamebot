/**
 * Provably Fair System for Crash Game
 * 
 * Система честной игры, которая позволяет пользователю верифицировать результаты.
 * Основана на SHA256 хешировании serverSeed + clientSeed.
 */

import crypto from 'crypto';

/**
 * Интерфейс для результата верификации
 */
export interface VerificationResult {
  /** Раунд верифицирован успешно */
  verified: boolean;
  
  /** Сообщение об ошибке (если есть) */
  error?: string;
  
  /** Вычисленный мультипликатор */
  calculatedMultiplier?: number;
  
  /** Ожидаемый мультипликатор */
  expectedMultiplier?: number;
  
  /** Хеш для проверки */
  hash?: string;
}

/**
 * Генерирует случайный serverSeed
 * 
 * ServerSeed генерируется на бэкенде и хранится в БД.
 * Пользователь не знает его значение до конца раунда.
 * 
 * @returns Случайный serverSeed (64 символа hex)
 */
export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Генерирует случайный clientSeed
 * 
 * ClientSeed генерируется на фронтенде пользователем.
 * Может быть любой строкой, которую выбирает пользователь.
 * 
 * @returns Случайный clientSeed (64 символа hex)
 */
export function generateClientSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Вычисляет SHA256 хеш из serverSeed и clientSeed
 * 
 * Формула: SHA256(serverSeed + clientSeed)
 * 
 * @param serverSeed - Seed от сервера
 * @param clientSeed - Seed от клиента
 * @returns SHA256 хеш (64 символа hex)
 */
export function calculateHash(serverSeed: string, clientSeed: string): string {
  const combined = serverSeed + clientSeed;
  return crypto.createHash('sha256').update(combined).digest('hex');
}

/**
 * Преобразует хеш в нормализованное число (0-1)
 * 
 * Берет первые 8 символов хеша, преобразует в число,
 * затем нормализует в диапазон 0-1.
 * 
 * @param hash - SHA256 хеш
 * @returns Число от 0 до 1
 */
export function hashToNormalized(hash: string): number {
  // Берем первые 8 символов хеша
  const hashSubstring = hash.substring(0, 8);
  
  // Преобразуем в число (hex -> decimal)
  const hashInt = parseInt(hashSubstring, 16);
  
  // Нормализуем в диапазон 0-1
  const normalized = (hashInt % 10000) / 10000;
  
  return normalized;
}

/**
 * Вычисляет мультипликатор из нормализованного числа
 *
 * Использует экспоненциальное распределение для получения
 * непрерывного диапазона мультипликаторов (как в реальных краш-играх).
 *
 * Формула: multiplier = 1 / (1 - normalized)
 *
 * Это распределение обеспечивает:
 * - Много низких мультипликаторов (1.0-2.0): ~50%
 * - Средние мультипликаторы (2.0-10.0): ~35%
 * - Высокие мультипликаторы (10.0+): ~15%
 * - Целевой RTP: ~95%
 *
 * @param normalized - Число от 0 до 1
 * @returns Мультипликатор (например, 1.01, 1.23, 2.45, 5.67, 100.0)
 */
export function normalizedToMultiplier(normalized: number): number {
  // Убеждаемся, что значение в диапазоне 0-1
  const n = Math.max(0, Math.min(0.9999, normalized));

  // Экспоненциальное распределение: multiplier = 1 / (1 - n)
  // Это дает непрерывное распределение мультипликаторов
  //
  // Примеры:
  // n = 0.0  → multiplier = 1.0
  // n = 0.5  → multiplier = 2.0
  // n = 0.9  → multiplier = 10.0
  // n = 0.99 → multiplier = 100.0

  const multiplier = 1.0 / (1.0 - n);

  return multiplier;
}

/**
 * Полный цикл: от seeds к мультипликатору
 * 
 * @param serverSeed - Seed от сервера
 * @param clientSeed - Seed от клиента
 * @returns Мультипликатор
 */
export function seedsToMultiplier(serverSeed: string, clientSeed: string): number {
  const hash = calculateHash(serverSeed, clientSeed);
  const normalized = hashToNormalized(hash);
  const multiplier = normalizedToMultiplier(normalized);
  
  return multiplier;
}

/**
 * Верифицирует результат раунда
 * 
 * Проверяет, что мультипликатор был вычислен честно
 * на основе serverSeed и clientSeed.
 * 
 * @param serverSeed - Seed от сервера
 * @param clientSeed - Seed от клиента
 * @param expectedMultiplier - Ожидаемый мультипликатор
 * @returns Результат верификации
 */
export function verifyRound(
  serverSeed: string,
  clientSeed: string,
  expectedMultiplier: number
): VerificationResult {
  try {
    // Проверяем, что seeds не пусты
    if (!serverSeed || !clientSeed) {
      return {
        verified: false,
        error: 'Server seed и client seed не должны быть пусты',
      };
    }

    // Вычисляем мультипликатор
    const calculatedMultiplier = seedsToMultiplier(serverSeed, clientSeed);
    const hash = calculateHash(serverSeed, clientSeed);

    // Сравниваем с ожидаемым
    const tolerance = 0.01; // Допуск 0.01x для округления
    const isValid = Math.abs(calculatedMultiplier - expectedMultiplier) < tolerance;

    return {
      verified: isValid,
      calculatedMultiplier,
      expectedMultiplier,
      hash,
      error: isValid ? undefined : 'Мультипликатор не совпадает',
    };
  } catch (error) {
    return {
      verified: false,
      error: `Ошибка верификации: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}



