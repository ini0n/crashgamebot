// Callback query handlers for inline buttons
import { Telegraf } from 'telegraf';
import { BotContext } from '../bot';
import { logger } from '../../utils/logger';

export function setupCallbackQueries(bot: Telegraf<BotContext>): void {
  // В текущей реализации все кнопки ведут на WebApp или внешние ссылки
  // Callback queries могут понадобиться для будущего функционала
  
  bot.on('callback_query', async (ctx) => {
    await handleCallbackQuery(ctx);
  });
}

/**
 * Обработчик callback queries
 */
async function handleCallbackQuery(ctx: BotContext): Promise<void> {
  try {
    const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
    
    logger.debug('🔘 Callback query received:', {
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
      data: callbackData
    });

    // Отвечаем на callback query, чтобы убрать "loading" состояние
    await ctx.answerCbQuery();

    // В будущем здесь можно добавить обработку различных callback действий
    switch (callbackData) {
      default:
        logger.warn('Unknown callback query:', { data: callbackData });
        break;
    }

  } catch (error) {
    logger.error('Error handling callback query:', error);
    
    try {
      await ctx.answerCbQuery('Произошла ошибка');
    } catch (answerError) {
      logger.error('Error answering callback query:', answerError);
    }
  }
}
