import { Response } from 'express';
import { logger } from '../../utils/logger';
import type { ApiResponse } from '../../../../shared/types/api';

export abstract class BaseController {
  /**
   * Обработка успешного ответа
   */
  protected success<T>(res: Response, data: T, statusCode: number = 200): void {
    const response: ApiResponse<T> = {
      success: true,
      data
    };
    
    res.status(statusCode).json(response);
  }

  /**
   * Обработка ошибки
   */
  protected error(
    res: Response, 
    message: string, 
    statusCode: number = 500,
    error?: Error
  ): void {
    if (error) {
      logger.error('Controller error:', {
        message,
        error: error.message,
        stack: error.stack
      });
    }

    const response: ApiResponse = {
      success: false,
      error: message
    };
    
    res.status(statusCode).json(response);
  }

  /**
   * Обработка ошибки валидации
   */
  protected validationError(res: Response, message: string): void {
    this.error(res, message, 400);
  }

  /**
   * Обертка для async методов контроллера
   */
  protected asyncHandler(fn: (req: any, res: Response) => Promise<void>) {
    return (req: any, res: Response): void => {
      Promise.resolve(fn(req, res)).catch((error) => {
        logger.error('Unhandled controller error:', {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined
        });
        this.error(res, 'Something went wrong. Please try again later.', 500, error);
      });
    };
  }
}
