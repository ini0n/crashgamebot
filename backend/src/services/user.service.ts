// User service for database operations
import { User as PrismaUser } from '@prisma/client';
import { logger } from '../utils/logger';
import { prisma, DatabaseConnection } from '../utils/database';
import type { User } from '../../../shared/types/user';

export interface CreateUserData {
  chatId: string;
  username?: string;
  firstname?: string;
  lastname?: string;
  active: boolean;
  banned: boolean;
  taskPoints: number;
  referrer?: string;
  tgLangCode?: string;
}

export interface UpdateUserData {
  username?: string;
  firstname?: string;
  lastname?: string;
  active?: boolean;
  status?: string;
  banned?: boolean;
  lastActivity?: Date;
  taskPoints?: number;
  tgLangCode?: string;
}

class UserService {
  constructor() {
    // Используем singleton prisma instance
  }

  /**
   * Конвертирует Prisma User в наш User тип
   */
  private convertPrismaUser(prismaUser: PrismaUser): User {
    return {
      chatId: prismaUser.chatId,
      username: prismaUser.username ?? undefined,
      firstname: prismaUser.firstname ?? undefined,
      lastname: prismaUser.lastname ?? undefined,
      active: prismaUser.active,
      status: prismaUser.status ?? undefined,
      banned: prismaUser.banned,
      lastActivity: prismaUser.lastActivity,
      referrer: prismaUser.referrer ?? undefined,
      taskPoints: prismaUser.taskPoints,
      tonBalance: prismaUser.tonBalance.toString(),
      starsBalance: prismaUser.starsBalance,
      referralType: prismaUser.referralType as 'basic' | 'plus',
      tgLangCode: prismaUser.tgLangCode ?? undefined,
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt
    };
  }

  /**
   * Проверка соединения с базой данных
   */
  public async initialize(): Promise<void> {
    try {
      // Простая проверка соединения - Prisma автоматически подключится при первом запросе
      await prisma.$queryRaw`SELECT 1`;
      logger.info('Database connection verified (UserService)');
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  /**
   * Найти пользователя по chat_id
   */
  public async findByChatId(chatId: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { chatId }
      });
      return user ? this.convertPrismaUser(user) : null;
    } catch (error) {
      logger.error('Error finding user by chatId:', { chatId, error });
      throw error;
    }
  }

  /**
   * Создать нового пользователя
   */
  public async create(userData: CreateUserData): Promise<User> {
    try {
      const user = await prisma.user.create({
        data: {
          chatId: userData.chatId,
          username: userData.username,
          firstname: userData.firstname,
          lastname: userData.lastname,
          active: userData.active,
          banned: userData.banned,
          taskPoints: userData.taskPoints,
          referrer: userData.referrer,
          tgLangCode: userData.tgLangCode,
          lastActivity: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      logger.info('User created:', { chatId: user.chatId });
      return this.convertPrismaUser(user);
    } catch (error) {
      logger.error('Error creating user:', { userData, error });
      throw error;
    }
  }

  /**
   * Обновить данные пользователя
   */
  public async update(chatId: string, updateData: UpdateUserData): Promise<User> {
    try {
      const user = await prisma.user.update({
        where: { chatId },
        data: {
          ...updateData,
          updatedAt: new Date()
        }
      });
      
      return this.convertPrismaUser(user);
    } catch (error) {
      logger.error('Error updating user:', { chatId, updateData, error });
      throw error;
    }
  }

  /**
   * Проверить, заблокирован ли пользователь
   */
  public async isBanned(chatId: string): Promise<boolean> {
    try {
      const user = await this.findByChatId(chatId);
      return user?.banned || false;
    } catch (error) {
      logger.error('Error checking if user is banned:', { chatId, error });
      return false;
    }
  }

  /**
   * Получить статистику пользователей
   */
  public async getStats(): Promise<{
    total: number;
    active: number;
    banned: number;
  }> {
    try {
      const [total, active, banned] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { active: true } }),
        prisma.user.count({ where: { banned: true } })
      ]);

      return { total, active, banned };
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw error;
    }
  }

  /**
   * Получить список рефералов с пагинацией и общим количеством
   */
  public async getReferrals(
    chatId: string, 
    page: number = 1, 
    limit: number = 10
  ): Promise<{
    referrals: User[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    try {
      const offset = (page - 1) * limit;
      
      // Получаем общее количество и список рефералов параллельно
      const [totalCount, prismaReferrals] = await Promise.all([
        prisma.user.count({
          where: { referrer: chatId }
        }),
        prisma.user.findMany({
          where: { referrer: chatId },
          orderBy: { createdAt: 'desc' }, // Новые рефералы первыми
          skip: offset,
          take: limit
        })
      ]);

      const referrals = prismaReferrals.map(user => this.convertPrismaUser(user));
      const totalPages = Math.ceil(totalCount / limit);

      return {
        referrals,
        totalCount,
        totalPages,
        currentPage: page
      };
    } catch (error) {
      logger.error('Error getting referrals list:', { chatId, page, limit, error });
      throw error;
    }
  }


  /**
   * Закрыть соединение с базой данных
   */
  public async disconnect(): Promise<void> {
    await DatabaseConnection.disconnect();
    logger.info('📤 Database disconnected (UserService)');
  }
}

// Singleton instance
export const userService = new UserService();
