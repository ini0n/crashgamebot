import { Telegraf } from 'telegraf';
import { logger } from '../utils/logger';

/**
 * Централизованный сервис для управления экземпляром Telegram бота
 * Использует Singleton pattern для обеспечения единого экземпляра
 */
class TelegramService {
  private static instance: TelegramService;
  private bot: Telegraf | null = null;

  private constructor() {}

  /**
   * Получить единственный экземпляр сервиса
   */
  public static getInstance(): TelegramService {
    if (!TelegramService.instance) {
      TelegramService.instance = new TelegramService();
    }
    return TelegramService.instance;
  }

  /**
   * Установить экземпляр бота (вызывается один раз при инициализации)
   */
  public setBotInstance(bot: Telegraf): void {
    if (this.bot) {
      logger.warn('Bot instance already set, overriding...');
    }
    this.bot = bot;
    logger.info('Telegram bot instance registered in TelegramService');
  }

  /**
   * Получить экземпляр бота
   * @throws Error если бот не инициализирован
   */
  public getBotInstance(): Telegraf {
    if (!this.bot) {
      logger.error('Attempted to get bot instance before initialization');
      throw new Error('Telegram bot instance not initialized. The bot may have failed to start or setBotInstance() was not called.');
    }
    return this.bot;
  }

  /**
   * Проверить, инициализирован ли бот
   */
  public isBotReady(): boolean {
    return this.bot !== null;
  }

  /**
   * Очистить экземпляр бота (для тестов или graceful shutdown)
   */
  public clearBotInstance(): void {
    this.bot = null;
    logger.info('🧹 Telegram bot instance cleared');
  }
}

// Экспортируем единственный экземпляр
export const telegramService = TelegramService.getInstance();

