// Logging middleware for bot interactions
import { MiddlewareFn } from 'telegraf';
import { BotContext } from '../bot';
import { logger } from '../../utils/logger';

export const loggingMiddleware: MiddlewareFn<BotContext> = async (ctx, next) => {
  const start = Date.now();
  
  // Логируем входящее обновление
  logger.debug('Bot update received:', {
    updateId: ctx.update.update_id,
    updateType: getUpdateType(ctx.update),
    chatId: ctx.chat?.id,
    userId: ctx.from?.id,
    username: ctx.from?.username,
    firstName: ctx.from?.first_name
  });

  try {
    await next();
    
    // Логируем успешную обработку
    const duration = Date.now() - start;
    logger.debug('Bot update processed:', {
      updateId: ctx.update.update_id,
      duration: `${duration}ms`,
      success: true
    });
    
  } catch (error) {
    // Логируем ошибку обработки
    const duration = Date.now() - start;
    logger.error('Bot update failed:', {
      updateId: ctx.update.update_id,
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};

function getUpdateType(update: any): string {
  if (update.message) return 'message';
  if (update.callback_query) return 'callback_query';
  if (update.inline_query) return 'inline_query';
  if (update.chosen_inline_result) return 'chosen_inline_result';
  if (update.channel_post) return 'channel_post';
  if (update.edited_message) return 'edited_message';
  if (update.edited_channel_post) return 'edited_channel_post';
  if (update.shipping_query) return 'shipping_query';
  if (update.pre_checkout_query) return 'pre_checkout_query';
  if (update.poll) return 'poll';
  if (update.poll_answer) return 'poll_answer';
  if (update.my_chat_member) return 'my_chat_member';
  if (update.chat_member) return 'chat_member';
  if (update.chat_join_request) return 'chat_join_request';
  return 'unknown';
}
