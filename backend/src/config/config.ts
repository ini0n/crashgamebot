import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '127.0.0.1',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://crashgamebot:password123@localhost:5432/crashgamebot',
  redisUrl: process.env.REDIS_URL || 'redis://:redis123@localhost:6379',

  // Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    webAppUrl: process.env.TELEGRAM_WEBAPP_URL || 'https://localhost-5173.devtunnels.ms',
    channelUrl: process.env.TELEGRAM_CHANNEL_URL || 'https://t.me/crashgamebot_channel'
  },

  // Frontend
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:5173'
  },

  // Game settings (будут использоваться при реализации игры)
  houseFee: parseFloat(process.env.HOUSE_FEE || '0.01'), // 1%
  minBetTon: parseFloat(process.env.MIN_BET_TON || '0.1'),
  minBetStars: parseInt(process.env.MIN_BET_STARS || '10'),

  // Cache settings (будут использоваться при реализации Express API)
  validationCacheLifetime: parseInt(process.env.VALIDATION_CACHE_LIFETIME || '300000'), // 5 minutes in milliseconds

  // TON Deposit settings
  ton: {
    depositAddress: process.env.TON_DEPOSIT_ADDRESS || '',
    network: process.env.TON_NETWORK || 'testnet', // 'mainnet' or 'testnet'
    minDepositTon: parseFloat(process.env.MIN_DEPOSIT_TON || '0.1'),
    maxDepositTon: parseFloat(process.env.MAX_DEPOSIT_TON || '1000'),
    toncenterMainnetToken: process.env.TONCENTER_MAINNET_TOKEN || '',
    toncenterTestnetToken: process.env.TONCENTER_TESTNET_TOKEN || '',
    monitoringInterval: parseInt(process.env.TON_MONITORING_INTERVAL || '10000', 10), // 10 seconds
    maxRetries: parseInt(process.env.TON_MAX_RETRIES || '10', 10),
    retryDelay: parseInt(process.env.TON_RETRY_DELAY || '1000', 10) // Base delay for exponential backoff
  }
};
