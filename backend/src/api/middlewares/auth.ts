import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';
import { userService } from '../../services/user.service';

interface AuthenticatedRequest extends Request {
  user?: {
    chatId: string;
    username?: string;
    firstname?: string;
    lastname?: string;
  };
}

// Интерфейс для initData
interface TelegramInitData {
  user?: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
  };
  auth_date?: number;
  hash?: string;
  query_id?: string;
}

/**
 * Валидация initData от Telegram WebApp
 */
export function validateTelegramInitData(initData: string): TelegramInitData | null {
  try {
    // Парсим URL-encoded данные
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash) {
      return null;
    }

    // Удаляем hash из параметров для проверки
    params.delete('hash');
    
    // Сортируем параметры и создаем строку для проверки
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Создаем секретный ключ
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(config.telegram.botToken)
      .digest();

    // Проверяем подпись
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (expectedHash !== hash) {
      return null;
    }

    // Парсим данные пользователя
    const userParam = params.get('user');
    const authDateParam = params.get('auth_date');
    const queryIdParam = params.get('query_id');

    const result: TelegramInitData = {};

    if (userParam) {
      result.user = JSON.parse(userParam);
    }

    if (authDateParam) {
      result.auth_date = parseInt(authDateParam, 10);
      
      // Проверяем, что данные не старше 24 часов
      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime - result.auth_date > 24 * 60 * 60) {
        return null;
      }
    }

    if (queryIdParam) {
      result.query_id = queryIdParam;
    }

    result.hash = hash;

    return result;
  } catch (error) {
    logger.error('Error validating Telegram initData:', error);
    return null;
  }
}

/**
 * Middleware для аутентификации запросов через Telegram initData
 */
export const authenticateRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const initData = req.headers['x-telegram-init-data'] as string;

    if (!initData) {
      res.status(401).json({
        success: false,
        error: 'Telegram initData required'
      });
      return;
    }

    // Валидируем initData
    const validatedData = validateTelegramInitData(initData);
    
    if (!validatedData || !validatedData.user) {
      res.status(401).json({
        success: false,
        error: 'Invalid Telegram initData'
      });
      return;
    }

    const telegramUser = validatedData.user;
    const chatId = telegramUser.id.toString();

    // Проверяем, существует ли пользователь в базе
    let user = await userService.findByChatId(chatId);
    
    if (!user) {
      // Создаем нового пользователя, если не существует
      user = await userService.create({
        chatId,
        username: telegramUser.username,
        firstname: telegramUser.first_name,
        lastname: telegramUser.last_name,
        active: true,
        banned: false,
        taskPoints: 0,
        tgLangCode: telegramUser.language_code || 'ru'
      });
    }

    // Проверяем, не заблокирован ли пользователь
    if (user.banned) {
      res.status(403).json({
        success: false,
        error: 'User is banned'
      });
      return;
    }

    // Добавляем данные пользователя в request
    req.user = {
      chatId: user.chatId,
      username: user.username,
      firstname: user.firstname,
      lastname: user.lastname
    };

    // Обновляем последнюю активность пользователя
    await userService.update(chatId, { lastActivity: new Date() });

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Экспортируем тип для использования в других файлах
export type { AuthenticatedRequest };
