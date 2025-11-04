import { isValidTonAddress, normalizeTonAddress } from '../utils/tonValidation';
import { logger } from '../utils/logger';
import { prisma } from '../utils/database';

class WalletService {
  constructor() {
    // Используем singleton prisma instance
  }

  /**
   * Подключить TON кошелек к пользователю
   */
  async connectWallet(chatId: string, walletAddress: string): Promise<{
    walletAddress: string;
    connectedAt: Date;
  }> {
    try {
      // Валидируем адрес кошелька
      if (!isValidTonAddress(walletAddress)) {
        throw new Error('Invalid TON wallet address format');
      }

      // Нормализуем адрес
      const normalizedAddress = normalizeTonAddress(walletAddress);

      // Проверяем, не используется ли этот адрес другим пользователем
      const existingUser = await prisma.user.findFirst({
        where: {
          tonWalletAddress: normalizedAddress,
          chatId: {
            not: chatId
          }
        }
      });

      if (existingUser) {
        throw new Error('This wallet address is already connected to another user');
      }

      // Обновляем пользователя
      const updatedUser = await prisma.user.update({
        where: { chatId },
        data: {
          tonWalletAddress: normalizedAddress,
          updatedAt: new Date()
        }
      });

      logger.info(`Wallet connected: user=${chatId}, address=${normalizedAddress}`);

      return {
        walletAddress: normalizedAddress,
        connectedAt: updatedUser.updatedAt
      };

    } catch (error) {
      logger.error('Failed to connect wallet:', {
        chatId,
        walletAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Отключить TON кошелек от пользователя
   */
  async disconnectWallet(chatId: string): Promise<void> {
    try {
      // Проверяем, что у пользователя есть подключенный кошелек
      const user = await prisma.user.findUnique({
        where: { chatId },
        select: { tonWalletAddress: true }
      });

      if (!user?.tonWalletAddress) {
        throw new Error('No wallet connected to this user');
      }

      // Отключаем кошелек
      await prisma.user.update({
        where: { chatId },
        data: {
          tonWalletAddress: null,
          updatedAt: new Date()
        }
      });

      logger.info(`Wallet disconnected: user=${chatId}, address=${user.tonWalletAddress}`);

    } catch (error) {
      logger.error('Failed to disconnect wallet:', {
        chatId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Получить статус кошелька пользователя
   */
  async getWalletStatus(chatId: string): Promise<{
    isConnected: boolean;
    walletAddress?: string;
    connectedAt?: Date;
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { chatId },
        select: {
          tonWalletAddress: true,
          updatedAt: true
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const isConnected = !!user.tonWalletAddress;

      return {
        isConnected,
        walletAddress: user.tonWalletAddress || undefined,
        connectedAt: isConnected ? user.updatedAt : undefined
      };

    } catch (error) {
      logger.error('Failed to get wallet status:', {
        chatId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Проверить, подключен ли кошелек к пользователю
   */
  async isWalletConnected(chatId: string): Promise<boolean> {
    try {
      const status = await this.getWalletStatus(chatId);
      return status.isConnected;
    } catch (error) {
      return false;
    }
  }

  /**
   * Получить адрес кошелька пользователя
   */
  async getUserWalletAddress(chatId: string): Promise<string | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { chatId },
        select: { tonWalletAddress: true }
      });

      return user?.tonWalletAddress || null;
    } catch (error) {
      logger.error('Failed to get user wallet address:', {
        chatId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }
}

// Singleton instance
export const walletService = new WalletService();
