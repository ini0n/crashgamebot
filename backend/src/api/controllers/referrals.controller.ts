import { Response } from 'express';  
import { z } from 'zod';
import { BaseController } from './base.controller';
import { userService } from '../../services/user.service';
import { logger } from '../../utils/logger';
import type { AuthenticatedRequest } from '../middlewares/auth';

// Схема валидации пагинации
const paginationSchema = z.object({
  page: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 1)
    .refine(val => val >= 1, { message: "Page must be >= 1" }),
  limit: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 10)
    .refine(val => val >= 1 && val <= 100, { 
      message: "Limit must be between 1 and 100" 
    })
});


export class ReferralsController extends BaseController {
  /**
   * Получить список рефералов пользователя с пагинацией
   * GET /api/referrals
   */
  public getReferrals = this.asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Валидация параметров пагинации
    const validationResult = paginationSchema.safeParse(req.query);
    
    if (!validationResult.success) {
      logger.warn('Invalid pagination parameters:', {
        chatId: req.user?.chatId,
        query: req.query,
        errors: validationResult.error.errors
      });
      this.validationError(res, 'Invalid pagination parameters');
      return;
    }

    const { page, limit } = validationResult.data;
    const chatId = req.user!.chatId;

    try {
      // Получаем данные через сервис
      const result = await userService.getReferrals(chatId, page, limit);

      // Возвращаем только нужные поля
      const referrals = result.referrals.map(user => ({
        username: user.username,
        firstname: user.firstname
      }));

      const response = {
        referrals,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        currentPage: result.currentPage
      };

      this.success(res, response);
    } catch (error) {
      logger.error('Failed to get referrals:', {
        chatId,
        page,
        limit,
        error: error instanceof Error ? error.message : error
      });
      
      this.error(res, 'Failed to get referrals', 500, error as Error);
    }
  });

}

// Экспортируем единственный экземпляр контроллера
export const referralsController = new ReferralsController();
