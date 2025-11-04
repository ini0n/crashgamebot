// Bot command handlers
import { Telegraf } from 'telegraf';
import { BotContext } from '../bot';
import { getMainMenuKeyboard } from '../keyboards/mainMenu';
import { userService } from '../../services/user.service';
import { logger } from '../../utils/logger';

export function setupCommands(bot: Telegraf<BotContext>): void {
  // Команда /start
  bot.start(async (ctx) => {
    await handleStartCommand(ctx);
  });

  // Команда /help  
  bot.help(async (ctx) => {
    await handleHelpCommand(ctx);
  });
}

/**
 * Обработчик команды /start
 */
async function handleStartCommand(ctx: BotContext): Promise<void> {
  try {
    const user = ctx.from;
    if (!user) return;

    logger.debug('📱 /start command:', {
      chatId: user.id,
      username: user.username,
      firstName: user.first_name
    });

    // Проверяем, не заблокирован ли пользователь
    const isBanned = await userService.isBanned(user.id.toString());
    if (isBanned) {
      await ctx.reply('Ваш аккаунт заблокирован. Обратитесь к администратору.');
      return;
    }

    // Отправляем приветственное сообщение с меню
    await ctx.reply(
      getWelcomeMessage(user.first_name),
      {
        reply_markup: getMainMenuKeyboard(),
        parse_mode: 'Markdown'
      }
    );

  } catch (error) {
    logger.error('Error in /start command:', error);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
}

/**
 * Обработчик команды /help
 */
async function handleHelpCommand(ctx: BotContext): Promise<void> {
  try {
    const user = ctx.from;
    if (!user) return;

    logger.debug('ℹ️ /help command:', {
      chatId: user.id,
      username: user.username
    });

    // Проверяем, не заблокирован ли пользователь
    const isBanned = await userService.isBanned(user.id.toString());
    if (isBanned) {
      await ctx.reply('Ваш аккаунт заблокирован. Обратитесь к администратору.');
      return;
    }

    // Отправляем то же меню, что и в /start
    await ctx.reply(
      getHelpMessage(),
      {
        reply_markup: getMainMenuKeyboard(),
        parse_mode: 'Markdown'
      }
    );

  } catch (error) {
    logger.error('Error in /help command:', error);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
}

/**
 * Получить приветственное сообщение
 */
function getWelcomeMessage(firstName?: string): string {
  const name = firstName || 'Игрок';
  
  return `🚀 *Добро пожаловать в Crash Game Bot, ${name}!*

💰 *Что тебя ждет:*
• 🎮 Захватывающая игра Crash с реальными ставками
• 🎁 Магазин эксклюзивных Telegram подарков  
• 💎 Ставки в TON, Stars и подарками
• 📈 Provably Fair - честная игра
• 👥 Реферальная программа

🎯 Выбери действие в меню ниже и начни играть!`;
}

/**
 * Получить сообщение помощи
 */
function getHelpMessage(): string {
  return `ℹ️ *Справка по Crash Game Bot*

🎮 *Как играть:*
• Делайте ставки в TON, Stars или подарками
• Следите за ростом мультипликатора
• Заберите выигрыш до краша ракеты!

💰 *Пополнение баланса:*
• Нажмите "Пополнение" для внесения средств
• Поддержка TON и Telegram Stars

🎁 *Магазин подарков:*
• Покупайте эксклюзивные Telegram подарки
• Дарите друзьям или используйте для ставок

❓ *Нужна помощь?* Обратитесь в поддержку через наш канал.

🎯 Выберите действие в меню:`;
}
