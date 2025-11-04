// Main entry point for the backend application
import { config } from './config/config';
import { logger } from './utils/logger';
import { TelegramBot } from './bot/bot';
import { userService } from './services/user.service';
import { telegramService } from './services/telegram.service';
import { app } from './api/app';
import { Server } from 'socket.io';
import { registerGameSocketHandlers } from './api/sockets/game.socket';
import { gameLoopService } from './services/gameLoop.service';

async function bootstrap() {
  try {
    logger.info('🚀 Starting CrashGameBot backend...');
    
    // Initialize database connection
    logger.info('📊 Initializing database...');
    await userService.initialize();
    
    // Start Express server first (независимо от бота)
    logger.info('🌐 Starting API server...');
    const server = app.listen(config.port, config.host, () => {
      logger.info(`API server started on http://${config.host}:${config.port}`);
    });

    // Обработка ошибок Express сервера
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.port} is already in use`);
      } else {
        logger.error('Express server error:', error);
      }
      throw error;
    });

    // Initialize Socket.IO
    logger.info('🔌 Initializing Socket.IO...');
    const io = new Server(server, {
      cors: {
        origin: [
          'https://web.telegram.org',
          'https://k.web.telegram.org',
          config.frontend.url,
          'http://localhost:5173',
          'http://127.0.0.1:5173',
        ],
        credentials: true,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    });

    // Register game socket handlers
    registerGameSocketHandlers(io);
    logger.info('Socket.IO initialized');

    // Initialize Game Loop Service
    logger.info('🎮 Initializing Game Loop Service...');
    await gameLoopService.initialize(io);

    // Start game loop
    await gameLoopService.start();
    logger.info('Game Loop Service started');

    // Initialize Telegram bot (after API is running)
    logger.info('🤖 Initializing Telegram bot...');
    const telegramBot = new TelegramBot();
    
    // Регистрируем экземпляр бота СРАЗУ (без запуска)
    telegramService.setBotInstance(telegramBot.getBot());
    logger.info('🎯 Telegram bot instance registered');
    
    // Запускаем бота в фоне (не ждем результата)
    telegramBot.start().then(() => {
      logger.info('Telegram bot started successfully');
    }).catch((error) => {
      logger.error('Failed to start Telegram bot:', error);
    });
    
    logger.info('Backend started successfully');
    
    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`📤 Received ${signal}, shutting down gracefully...`);

      try {
        // Останавливаем Game Loop Service
        await gameLoopService.stop();
        logger.info('🎮 Game Loop Service stopped');

        // Закрываем Socket.IO
        io.close();
        logger.info('🔌 Socket.IO closed');

        // Закрываем HTTP сервер
        server.close(() => {
          logger.info('🌐 API server closed');
        });

        await userService.disconnect();
        telegramService.clearBotInstance();
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    
  } catch (error) {
    logger.error('Failed to start backend:', error);
    await userService.disconnect();
    telegramService.clearBotInstance();
    process.exit(1);
  }
}

bootstrap();
