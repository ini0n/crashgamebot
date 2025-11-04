// Main Telegram Bot initialization and setup
import { Telegraf, Context } from 'telegraf';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { setupCommands } from './handlers/commands';
import { setupCallbackQueries } from './handlers/callbacks';
import { setupPaymentHandlers } from './handlers/payments';
import { setupMiddlewares } from './middlewares';

export interface BotContext extends Context {
  // Расширенный контекст для типизации
}

export class TelegramBot {
  private bot: Telegraf<BotContext>;

  constructor() {
    // Проверяем наличие токена
    if (!config.telegram.botToken) {
      logger.error('TELEGRAM_BOT_TOKEN is not set in environment variables');
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }

    logger.info(`🔑 Using bot token: ${config.telegram.botToken.substring(0, 10)}...`);

    this.bot = new Telegraf<BotContext>(config.telegram.botToken, {
      telegram: {
        testEnv: false
      }
    });
    this.setupBot();
  }

  private setupBot(): void {
    // Подключаем middleware
    setupMiddlewares(this.bot);
    
    // Подключаем обработчики команд
    setupCommands(this.bot);
    
    // Подключаем обработчики callback queries
    setupCallbackQueries(this.bot);
    
    // Подключаем обработчики платежей
    setupPaymentHandlers(this.bot);

    // Обработка ошибок
    this.bot.catch((err, ctx) => {
      logger.error('Bot error:', err);
      logger.error('Context:', {
        updateId: ctx.update.update_id,
        chatId: ctx.chat?.id,
        userId: ctx.from?.id
      });
    });
  }

  public async start(): Promise<void> {
    try {
      logger.info('🚀 Starting Telegram bot...');

      await this.bot.launch();
      logger.info('Telegram Bot started successfully');

      // Graceful shutdown
      process.once('SIGINT', () => this.stop('SIGINT'));
      process.once('SIGTERM', () => this.stop('SIGTERM'));

    } catch (error) {
      logger.error('Failed to start Telegram Bot:', error);
      logger.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private async stop(signal: string): Promise<void> {
    logger.info(`🛑 Received ${signal}, stopping bot...`);
    await this.bot.stop(signal);
    logger.info('Bot stopped gracefully');
  }

  public getBot(): Telegraf<BotContext> {
    return this.bot;
  }
}
