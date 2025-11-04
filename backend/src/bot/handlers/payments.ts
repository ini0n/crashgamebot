// Payment handlers for Telegram Stars
import { Telegraf, Context } from 'telegraf';
import { Update } from 'telegraf/types';
import { logger } from '../../utils/logger';
import { starsService } from '../../services/stars.service';
import { i18nService } from '../../i18n/i18n.service';
import { telegramService } from '../../services/telegram.service';

/**
 * Setup payment handlers for Telegram Stars
 */
export function setupPaymentHandlers(bot: Telegraf): void {
  /**
   * Pre-checkout query handler
   * Вызывается ДО того как пользователь подтвердит платеж
   * Здесь мы можем отклонить платеж если что-то не так
   */
  bot.on('pre_checkout_query', async (ctx) => {
    try {
      const query = ctx.preCheckoutQuery;
      const transactionId = query.invoice_payload;

      logger.info('Pre-checkout query received', {
        transactionId,
        userId: ctx.from?.id,
        currency: query.currency,
        totalAmount: query.total_amount
      });

      // Валидация: проверяем что это Stars
      if (query.currency !== 'XTR') {
        await ctx.answerPreCheckoutQuery(false, 'Invalid currency');
        logger.warn('Invalid currency in pre-checkout', {
          transactionId,
          currency: query.currency
        });
        return;
      }

      // TODO: Дополнительная валидация транзакции если нужно
      // Можно проверить что транзакция существует и в статусе pending

      // Подтверждаем платеж
      await ctx.answerPreCheckoutQuery(true);

      logger.info('Pre-checkout query approved', {
        transactionId,
        userId: ctx.from?.id
      });
    } catch (error) {
      logger.error('Pre-checkout query error:', error);
      try {
        await ctx.answerPreCheckoutQuery(false, 'Payment processing error');
      } catch (answerError) {
        logger.error('Failed to answer pre-checkout query:', answerError);
      }
    }
  });

  /**
   * Successful payment handler
   * Вызывается ПОСЛЕ успешной оплаты
   * Здесь мы зачисляем Stars на баланс
   */
  bot.on('successful_payment', async (ctx) => {
    try {
      const payment = ctx.message?.successful_payment;
      
      if (!payment) {
        logger.error('Successful payment without payment data');
        return;
      }

      const transactionId = payment.invoice_payload;
      const telegramChargeId = payment.telegram_payment_charge_id;
      const chatId = ctx.chat?.id.toString();

      logger.info('Successful payment received', {
        transactionId,
        telegramChargeId,
        chatId,
        currency: payment.currency,
        totalAmount: payment.total_amount
      });

      // Подтверждаем депозит в базе данных
      const result = await starsService.confirmDeposit(transactionId, telegramChargeId);

      // Получаем язык пользователя
      const lang = ctx.from?.language_code || 'ru';

      // Отправляем уведомление пользователю
      const message = i18nService.t(
        'deposit.stars_success',
        {
          amount: result.transaction.amount.toString(),
          balance: result.newBalance.toString()
        },
        lang
      );

      await ctx.reply(message, {
        parse_mode: 'HTML'
      });

      // Если есть реферальный бонус - уведомляем реферера
      if (result.referralBonus) {
        try {
          const bot = telegramService.getBotInstance();
          const bonusMessage = i18nService.t('referral.bonus_earned', {
            amount: `${result.referralBonus.commissionAmount} Stars`,
            referralId: chatId
          }, 'ru'); // TODO: получать язык реферера из БД

          await bot.telegram.sendMessage(result.referralBonus.referrerChatId, bonusMessage, {
            parse_mode: 'HTML'
          });

          logger.info('Referral bonus notification sent', {
            referrerChatId: result.referralBonus.referrerChatId,
            commissionAmount: result.referralBonus.commissionAmount,
            currency: 'stars'
          });
        } catch (notificationError) {
          logger.error('Failed to send referral bonus notification:', {
            error: notificationError,
            referrerChatId: result.referralBonus.referrerChatId
          });
        }
      }

      logger.info('Stars deposit completed', {
        transactionId,
        chatId,
        amount: result.transaction.amount,
        newBalance: result.newBalance,
        referralBonus: result.referralBonus
      });
    } catch (error) {
      logger.error('Successful payment processing error:', error);

      // Уведомляем пользователя об ошибке
      try {
        const lang = ctx.from?.language_code || 'ru';
        const errorMessage = i18nService.t('deposit.error', { reason: 'Ошибка обработки платежа' }, lang);
        await ctx.reply(errorMessage, { parse_mode: 'HTML' });
      } catch (replyError) {
        logger.error('Failed to send error message:', replyError);
      }
    }
  });

  logger.info('✅ Payment handlers configured');
}

