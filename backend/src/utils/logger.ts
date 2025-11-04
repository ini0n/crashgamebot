import winston from 'winston';
import { config } from '../config/config';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'crashgamebot-backend' },
  transports: [
    // Только ошибки в файл
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
  ],
});

// In development, also log to console with colorized output
if (config.nodeEnv !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}
