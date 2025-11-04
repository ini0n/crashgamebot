import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';
import { config } from '../config/config';

// Import routes
import referralsRouter from './routes/referrals';
import walletRouter from './routes/wallet';
import depositRouter from './routes/deposit';
import gameRouter from './routes/game';

const app = express();

// Trust proxy for rate limiting - только для разработки
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Для WebApp
}));

// CORS настройки для Telegram WebApp
app.use(cors({
  origin: [
    'https://web.telegram.org',
    'https://k.web.telegram.org', 
    config.frontend.url, // URL фронтенда из конфига
    'http://localhost:5173', // Для разработки
    'http://127.0.0.1:5173', // Альтернативный localhost
    /^https:\/\/.*\.devtunnels\.ms$/, // VS Code dev tunnels
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Telegram-Init-Data']
}));

// Rate limiting - бан на 5 минут при превышении 1000+ запросов в минуту
const rateLimitMiddleware = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // Max 1000 requests per minute per IP
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Бан на 5 минут при превышении лимита
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

app.use(rateLimitMiddleware);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Явная обработка preflight запросов для всех API маршрутов
app.options('/api/*', cors());

// API routes
app.use('/api/referrals', referralsRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/deposit', depositRouter);
app.use('/api/game', gameRouter);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response) => {
  logger.error('Unhandled API error:', {
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

export { app };
