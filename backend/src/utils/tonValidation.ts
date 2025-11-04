/**
 * Утилиты для валидации TON адресов
 */

/**
 * Проверяет валидность TON адреса
 * @param address - Адрес TON кошелька
 * @returns true если адрес валидный
 */
export function isValidTonAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }

  // Убираем пробелы
  const cleanAddress = address.trim();

  // TON адреса могут быть в разных форматах:
  // 1. Raw format: 0:83dfd552e63729b472fcbcc8c45ebcc6691702558b68ec7527e1ba403a0f31a8
  // 2. User-friendly format: EQD6_VUuY3KbRy_LzIxF68xpkXAlWLaOx1J-G6QDoD8xqEIb
  // 3. Bounceable format: EQD6_VUuY3KbRy_LzIxF68xpkXAlWLaOx1J-G6QDoD8xqEIb

  // Проверяем raw format (0: + 64 hex символа)
  const rawFormatRegex = /^(-1|0):[a-fA-F0-9]{64}$/;
  if (rawFormatRegex.test(cleanAddress)) {
    return true;
  }

  // Проверяем user-friendly format
  // Начинается с E, U, k, 0 и содержит 48 символов (1 префикс + 47 base64)
  const userFriendlyRegex = /^[EUk0][A-Za-z0-9_-]{47}$/;
  if (userFriendlyRegex.test(cleanAddress)) {
    return true;
  }

  return false;
}

/**
 * Нормализует TON адрес к стандартному формату
 * @param address - Адрес TON кошелька
 * @returns нормализованный адрес
 */
export function normalizeTonAddress(address: string): string {
  if (!isValidTonAddress(address)) {
    throw new Error('Invalid TON address format');
  }

  // Убираем пробелы и приводим к lowercase (кроме user-friendly формата)
  const cleanAddress = address.trim();
  
  // Если это raw format, приводим к lowercase
  if (cleanAddress.includes(':')) {
    return cleanAddress.toLowerCase();
  }

  // User-friendly формат оставляем как есть (case-sensitive)
  return cleanAddress;
}

/**
 * Проверяет является ли адрес testnet адресом
 * @param address - Адрес TON кошелька
 * @returns true если это testnet адрес
 */
export function isTestnetAddress(address: string): boolean {
  // В testnet адреса обычно имеют workchain -1 в raw формате
  // или начинаются с kQ в user-friendly формате
  const cleanAddress = address.trim();
  
  if (cleanAddress.startsWith('-1:')) {
    return true;
  }
  
  if (cleanAddress.startsWith('kQ')) {
    return true;
  }
  
  return false;
}

/**
 * Извлекает workchain из TON адреса
 * @param address - Адрес TON кошелька
 * @returns workchain id или null если не удалось определить
 */
export function getWorkchainFromAddress(address: string): number | null {
  const cleanAddress = address.trim();
  
  // Для raw формата
  if (cleanAddress.includes(':')) {
    const parts = cleanAddress.split(':');
    const workchain = parseInt(parts[0], 10);
    return isNaN(workchain) ? null : workchain;
  }
  
  // Для user-friendly формата определяем по префиксу
  if (cleanAddress.startsWith('E') || cleanAddress.startsWith('U')) {
    return 0; // mainnet workchain
  }
  
  if (cleanAddress.startsWith('k') || cleanAddress.startsWith('0')) {
    return -1; // testnet workchain
  }
  
  return null;
}
