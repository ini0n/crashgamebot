// Bot middlewares setup
import { Telegraf } from 'telegraf';
import { BotContext } from '../bot';
import { userRegistrationMiddleware } from './userRegistration';
import { loggingMiddleware } from './logging';

export function setupMiddlewares(bot: Telegraf<BotContext>): void {
  // Логирование всех обновлений
  bot.use(loggingMiddleware);
  
  // Автоматическая регистрация пользователей
  bot.use(userRegistrationMiddleware);
}
