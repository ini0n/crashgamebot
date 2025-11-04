// Referral system utilities
import { config } from '../config/config';

/**
 * Генерирует реферальную ссылку для пользователя
 */
export function generateReferralLink(chatId: string, botUsername?: string): string {
  // Если есть username бота, используем его, иначе fallback
  const username = botUsername || 'crashgamebobot'; // TODO: получать из конфига
  
  return `https://t.me/${username}?start=${chatId}`;
}

/**
 * Извлекает ID реферера из команды /start
 */
export function extractReferrerFromStart(startText: string): string | null {
  const parts = startText.split(' ');
  
  if (parts.length < 2 || !parts[1]) {
    return null;
  }
  
  const referrerId = parts[1].trim();
  
  // Базовая валидация - должно быть числом (Telegram ID)
  if (!/^\d+$/.test(referrerId)) {
    return null;
  }
  
  return referrerId;
}

/**
 * Проверяет, является ли referrer ID валидным
 */
export function isValidReferrerId(referrerId: string, currentUserId: string): boolean {
  // Нельзя приглашать самого себя
  if (referrerId === currentUserId) {
    return false;
  }
  
  // Должно быть числовым ID
  if (!/^\d+$/.test(referrerId)) {
    return false;
  }
  
  return true;
}
