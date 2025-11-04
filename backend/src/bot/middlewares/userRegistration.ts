// User registration middleware - creates users in database
import { MiddlewareFn } from 'telegraf';
import { BotContext } from '../bot';
import { userService } from '../../services/user.service';
import { logger } from '../../utils/logger';
import { extractReferrerFromStart, isValidReferrerId } from '../../utils/referral';

export const userRegistrationMiddleware: MiddlewareFn<BotContext> = async (ctx, next) => {
  // Пропускаем, если нет информации о пользователе
  if (!ctx.from) {
    return next();
  }

  // Сохраняем данные пользователя ДО асинхронной операции
  const fromUser = ctx.from;
  const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;

  // НЕМЕДЛЕННО вызываем next() - не блокируем обработку сообщения
  await next();

  // DB операции выполняем ПОСЛЕ обработки сообщения (неблокирующе)
  setImmediate(async () => {
    try {
      const chatId = fromUser.id.toString();
      
      // Проверяем, существует ли пользователь
      const existingUser = await userService.findByChatId(chatId);
    
    if (!existingUser) {
      // Извлекаем реферера из команды /start для новых пользователей
      let referrerId: string | undefined;
      
      if (messageText?.startsWith('/start')) {
        const extractedReferrer = extractReferrerFromStart(messageText);
        
        if (extractedReferrer && isValidReferrerId(extractedReferrer, chatId)) {
          // Проверяем, что реферер существует в базе данных
          const referrer = await userService.findByChatId(extractedReferrer);
          if (referrer) {
            referrerId = extractedReferrer;
            logger.debug('📢 Referral detected:', {
              newUserId: chatId,
              referrerId: extractedReferrer,
              referrerUsername: referrer.username
            });
          } else {
            logger.debug('Invalid referrer - user not found:', {
              newUserId: chatId,
              invalidReferrerId: extractedReferrer
            });
          }
        } else {
          logger.debug('Invalid referrer ID:', {
            newUserId: chatId,
            invalidReferrerId: extractedReferrer
          });
        }
      }
      
      // Создаем нового пользователя
      const newUser = await userService.create({
        chatId: chatId,
        username: fromUser.username,
        firstname: fromUser.first_name,
        lastname: fromUser.last_name,
        active: true,
        banned: false,
        taskPoints: 0,
        referrer: referrerId,
        tgLangCode: fromUser.language_code
      });
      
      logger.info('👤 New user registered:', {
        chatId: newUser.chatId,
        username: newUser.username,
        firstName: newUser.firstname,
        referrer: newUser.referrer
      });
    } else {
      // Обновляем данные существующего пользователя
      await userService.update(chatId, {
        username: fromUser.username,
        firstname: fromUser.first_name,
        lastname: fromUser.last_name,
        lastActivity: new Date(),
        tgLangCode: fromUser.language_code
      });
    } 
    
    } catch (error) {
      logger.error('User registration failed:', {
        chatId: fromUser.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
};
