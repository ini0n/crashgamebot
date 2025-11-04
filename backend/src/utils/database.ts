import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { logger } from './logger';

/**
 * Единственный экземпляр PrismaClient для всего приложения
 * Singleton pattern для оптимального использования соединений с БД
 */
class DatabaseConnection {
  private static instance: PrismaClient | null = null;

  /**
   * Получить экземпляр PrismaClient (создает если не существует)
   */
  public static getInstance(): PrismaClient {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new PrismaClient({
        log: [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'event' },
          { level: 'info', emit: 'event' },
          { level: 'warn', emit: 'event' },
        ],
      });

      // Логирование SQL запросов в development
      if (process.env.NODE_ENV === 'development') {
        (DatabaseConnection.instance as any).$on('query', (e: Prisma.QueryEvent) => {
          logger.debug('Database Query:', {
            query: e.query,
            params: e.params,
            duration: `${e.duration}ms`
          });
        });
      }

      // Логирование ошибок
      (DatabaseConnection.instance as any).$on('error', (e: Prisma.LogEvent) => {
        logger.error('Database Error:', e);
      });

      logger.info('Database connection established');
    }

    return DatabaseConnection.instance;
  }

  /**
   * Отключиться от базы данных (для graceful shutdown)
   */
  public static async disconnect(): Promise<void> {
    if (DatabaseConnection.instance) {
      await DatabaseConnection.instance.$disconnect();
      DatabaseConnection.instance = null;
      logger.info('Database connection closed');
    }
  }
}

// Экспортируем единственный экземпляр
export const prisma = DatabaseConnection.getInstance();

// Экспортируем класс для управления соединением
export { DatabaseConnection };
