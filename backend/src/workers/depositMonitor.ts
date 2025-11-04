/**
 * Deposit Monitor Worker
 * 
 * Мониторит входящие TON транзакции на депозитный адрес
 * Основан на TonCenter AccountSubscription примере
 * 
 * Референс: backend/docs/TONCENTER_REFERENCE.md
 */

import TonWeb from 'tonweb';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { prisma } from '../utils/database';
import { transactionService } from '../services/transaction.service';
import { referralService } from '../services/referral.service';
import { i18nService } from '../i18n/i18n.service';
import { TransactionType, TransactionStatus, CurrencyType } from '@prisma/client';
import Decimal from 'decimal.js';

// ==========================================
// Configuration
// ==========================================

const isMainnet = config.ton.network === 'mainnet';
const DEPOSIT_WALLET_ADDRESS = config.ton.depositAddress;
const MIN_DEPOSIT_TON = config.ton.minDepositTon;

// ==========================================
// Telegram Notifications (Direct API)
// ==========================================

/**
 * Отправка сообщения через Telegram Bot API
 */
async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Telegram API error: ${error}`);
    }

    logger.debug('Telegram notification sent', { chatId });
  } catch (error) {
    logger.error('Error sending Telegram notification:', {
      error: error instanceof Error ? error.message : String(error),
      chatId
    });
  }
}

/**
 * Уведомление об успешном депозите
 */
async function notifyDepositSuccess(
  chatId: string,
  amount: string,
  txHash: string,
  referralBonus?: { referrerChatId: string; amount: string }
): Promise<void> {
  const langCode = 'ru'; // TODO: получать из БД
  
  const message = i18nService.t('deposit.success', {
    amount,
    txHash: txHash.substring(0, 8) + '...'
  }, langCode);

  await sendTelegramMessage(chatId, message);

  // Если есть реферальный бонус - уведомляем реферера
  if (referralBonus) {
    const bonusMessage = i18nService.t('referral.bonus_earned', {
      amount: referralBonus.amount,
      referralId: chatId
    }, langCode);
    await sendTelegramMessage(referralBonus.referrerChatId, bonusMessage);
  }
}

// Инициализация TonWeb с правильным API ключом
const tonweb = isMainnet
  ? new TonWeb(new TonWeb.HttpProvider('https://toncenter.com/api/v2/jsonRPC', {
      apiKey: config.ton.toncenterMainnetToken
    }))
  : new TonWeb(new TonWeb.HttpProvider('https://testnet.toncenter.com/api/v2/jsonRPC', {
      apiKey: config.ton.toncenterTestnetToken
    }));

// ==========================================
// State Management (Persistence)
// ==========================================

/**
 * Загрузка startTime из БД при старте
 */
const loadStartTime = async (): Promise<number> => {
  try {
    const state = await prisma.depositMonitoringState.findUnique({
      where: { id: 'singleton' }
    });

    if (!state) {
      // Первый запуск - используем 0 (AccountSubscription начнет с текущего момента)
      // Это правильный подход по примеру TonCenter
      await prisma.depositMonitoringState.create({
        data: {
          id: 'singleton',
          network: config.ton.network,
          startTime: 0,
          isRunning: true
        }
      });
      logger.info('🆕 First run - created monitoring state with startTime=0 (will start from current moment)');
      return 0;
    }

    // Проверка на валидность startTime
    const now = Math.floor(Date.now() / 1000);
    
    // startTime должен быть либо 0, либо валидный Unix timestamp из прошлого
    if (state.startTime > 0 && state.startTime > now) {
      logger.warn('⚠️ Invalid startTime detected (in the future), resetting to 0', {
        oldStartTime: state.startTime,
        oldStartTimeDate: new Date(state.startTime * 1000).toISOString()
      });
      await prisma.depositMonitoringState.update({
        where: { id: 'singleton' },
        data: {
          startTime: 0,
          isRunning: true
        }
      });
      return 0;
    }

    logger.info('📂 Loaded startTime from database', {
      startTime: state.startTime,
      startTimeDate: state.startTime > 0 ? new Date(state.startTime * 1000).toISOString() : 'current moment (0)',
      network: state.network,
      lastCheckAt: state.lastCheckAt
    });
    return state.startTime;
  } catch (error) {
    logger.error('Error loading startTime:', error);
    throw error;
  }
};

/**
 * Сохранение startTime после обработки транзакций
 */
const saveStartTime = async (startTime: number): Promise<void> => {
  try {
    await prisma.depositMonitoringState.update({
      where: { id: 'singleton' },
      data: {
        startTime,
        lastCheckAt: new Date(),
        errorCount: 0, // сбрасываем при успехе
        isRunning: true
      }
    });
  } catch (error) {
    logger.error('Error saving startTime:', { error, startTime });
    throw error;
  }
};

/**
 * Увеличение счетчика ошибок
 */
const incrementErrorCount = async (error: Error): Promise<void> => {
  try {
    await prisma.depositMonitoringState.update({
      where: { id: 'singleton' },
      data: {
        errorCount: { increment: 1 },
        lastError: error.message,
        lastCheckAt: new Date()
      }
    });
  } catch (err) {
    logger.error('Error incrementing error count:', err);
  }
};

// ==========================================
// Transaction Processing
// ==========================================

/**
 * Обработчик транзакций (callback для AccountSubscription)
 */
const onTransaction = async (tx: any) => {
  try {
    // 1. Проверка: входящая транзакция БЕЗ исходящих (защита от bounce)
    if (!tx.in_msg?.source || tx.out_msgs.length > 0) {
      logger.debug('Skipping: not incoming or has outgoing messages', {
        hasSource: !!tx.in_msg?.source,
        outMsgsCount: tx.out_msgs.length
      });
      return;
    }

    // 2. Проверка: наличие текстового комментария
    if (!tx.in_msg.msg_data || tx.in_msg.msg_data['@type'] !== 'msg.dataText') {
      logger.debug('Skipping: no text comment');
      return;
    }

    // 3. Извлечение данных транзакции
    const valueNano = tx.in_msg.value; // nano-TON
    const senderAddress = tx.in_msg.source;
    const comment = tx.in_msg.message;
    const txHash = tx.transaction_id.hash;
    const txLt = tx.transaction_id.lt;
    const timestamp = tx.utime;

    // Конвертация nano-TON → TON
    const amountTON = TonWeb.utils.fromNano(valueNano);

    logger.info('📥 Incoming transaction detected', {
      txHash,
      txLt,
      amount: amountTON,
      sender: senderAddress,
      comment,
      timestamp: new Date(timestamp * 1000).toISOString()
    });

    // 4. Валидация комментария (формат: dep_{chatId})
    if (!comment?.startsWith('dep_')) {
      logger.debug('Invalid comment format', { comment, txHash });
      return;
    }

    const chatId = comment.replace('dep_', '').trim();

    if (!chatId || chatId.length === 0) {
      logger.debug('Empty chatId in comment', { comment, txHash });
      return;
    }

    // 5. Проверка на дубликат транзакции
    const exists = await transactionService.existsByHash(txHash);
    if (exists) {
      logger.warn('⚠️ Duplicate transaction, skipping', { txHash });
      return;
    }

    // 6. Валидация пользователя
    const user = await prisma.user.findUnique({
      where: { chatId },
      select: {
        chatId: true,
        banned: true,
        referrer: true
      }
    });

    if (!user) {
      logger.error('❌ User not found', { chatId, txHash });
      // Не отправляем уведомление - пользователь не найден
      return;
    }

    if (user.banned) {
      logger.error('❌ User is banned', { chatId, txHash });
      const errorMessage = i18nService.t('deposit.error', {
        reason: 'Ваш аккаунт заблокирован',
        amount: amountTON
      }, 'ru');
      await sendTelegramMessage(chatId, errorMessage);
      return;
    }

    // 7. Проверка минимальной суммы депозита
    const amountDecimal = new Decimal(amountTON);
    if (amountDecimal.lt(MIN_DEPOSIT_TON)) {
      logger.warn('❌ Amount below minimum', {
        amount: amountTON,
        minAmount: MIN_DEPOSIT_TON,
        chatId,
        txHash
      });
      const errorMessage = i18nService.t('deposit.error', {
        reason: `Минимальная сумма депозита: ${MIN_DEPOSIT_TON} TON`,
        amount: amountTON
      }, 'ru');
      await sendTelegramMessage(chatId, errorMessage);
      return;
    }

    // 8. Атомарная обработка депозита
    logger.info('💰 Processing deposit', {
      chatId,
      amount: amountTON,
      txHash
    });

    const result = await prisma.$transaction(async (tx) => {
      // 8.1. Создание записи транзакции
      const transaction = await transactionService.create(
        {
          chatId,
          type: TransactionType.deposit,
          amount: amountTON,
          currency: CurrencyType.ton,
          status: TransactionStatus.completed,
          externalId: txHash,
          metadata: {
            senderAddress,
            txLt,
            timestamp,
            comment
          }
        },
        tx
      );

      // 8.2. Зачисление средств на баланс
      const updatedUser = await transactionService.creditUserBalance(
        chatId,
        amountTON,
        tx
      );

      // 8.3. Обработка реферального бонуса (если есть реферер)
      let referralBonus = null;
      if (user.referrer) {
        referralBonus = await referralService.processDepositCommission(
          chatId,
          amountTON,
          transaction.id,
          tx,
          CurrencyType.ton
        );
      }

      return {
        transaction,
        updatedUser,
        referralBonus
      };
    });

    logger.info('✅ Deposit processed successfully', {
      chatId,
      amount: amountTON,
      txHash,
      newBalance: result.updatedUser.tonBalance.toString(),
      referralBonus: result.referralBonus
    });

    // 9. Уведомление пользователя
    await notifyDepositSuccess(
      chatId,
      amountTON,
      txHash,
      result.referralBonus ? {
        referrerChatId: result.referralBonus.referrerChatId,
        amount: result.referralBonus.commissionAmount
      } : undefined
    );

  } catch (error) {
    logger.error('❌ Error processing transaction:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      tx: JSON.stringify(tx, null, 2)
    });

    // Инкрементируем счетчик ошибок
    if (error instanceof Error) {
      await incrementErrorCount(error);
    }
  }
};

// ==========================================
// AccountSubscription Implementation
// ==========================================

/**
 * Класс для мониторинга транзакций
 * Адаптация TonCenter AccountSubscription на TypeScript
 */
class AccountSubscription {
  private tonweb: any;
  private accountAddress: string;
  public startTime: number;
  private onTransaction: (tx: any) => Promise<void>;

  constructor(
    tonweb: any,
    accountAddress: string,
    startTime: number,
    onTransaction: (tx: any) => Promise<void>
  ) {
    this.tonweb = tonweb;
    this.accountAddress = accountAddress;
    this.startTime = startTime;
    this.onTransaction = onTransaction;
  }

  /**
   * Вспомогательная функция для ожидания
   */
  private wait(millis: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, millis));
  }

  /**
   * Получение транзакций с пагинацией и retry
   */
  private async getTransactions(
    time: number | undefined,
    offsetTransactionLT: string | undefined,
    offsetTransactionHash: string | undefined,
    retryCount: number
  ): Promise<number> {
    const COUNT = 10;

    if (offsetTransactionLT) {
      logger.debug(`Get ${COUNT} transactions before ${offsetTransactionLT}:${offsetTransactionHash}`);
    } else {
      logger.debug(`Get last ${COUNT} transactions`);
    }

    let transactions;

    try {
      transactions = await this.tonweb.provider.getTransactions(
        this.accountAddress,
        COUNT,
        offsetTransactionLT,
        offsetTransactionHash
      );
    } catch (e) {
      logger.error(e);
      // if an API error occurs, try again
      retryCount++;
      if (retryCount < 10) {
        await this.wait(retryCount * 1000);
        return this.getTransactions(time, offsetTransactionLT, offsetTransactionHash, retryCount);
      } else {
        return 0;
      }
    }

    logger.debug(`Got ${transactions.length} transactions`);

    if (!transactions.length) {
      // If you use your own API instance make sure the code contains this fix https://github.com/toncenter/ton-http-api/commit/a40a31c62388f122b7b7f3da7c5a6f706f3d2405
      // If you use public toncenter.com then everything is OK.
      return time || 0;
    }

    if (!time) time = transactions[0].utime;

    // Обработка каждой транзакции - ТОЧНО КАК В РЕФЕРЕНСЕ
    for (const tx of transactions) {
      if (tx.utime < this.startTime) {
        // Транзакция старше startTime - возвращаем time и останавливаемся
        return time || 0;
      }

      await this.onTransaction(tx);
    }

    if (transactions.length === 1) {
      return time || 0;
    }

    const lastTx = transactions[transactions.length - 1];
    return await this.getTransactions(time, lastTx.transaction_id.lt, lastTx.transaction_id.hash, 0);
  }

  /**
   * Запуск мониторинга
   */
  async start(): Promise<void> {
    let isProcessing = false;

    const tick = async () => {
      if (isProcessing) {
        logger.debug('Previous tick still processing, skipping');
        return;
      }
      isProcessing = true;

      try {
        logger.debug('🔍 Checking for new transactions...');
        const result = await this.getTransactions(undefined, undefined, undefined, 0);
        if (result > 0) {
          this.startTime = result;
          await saveStartTime(result); // ⬅️ СОХРАНЯЕМ В БД
          logger.debug('✅ Check complete, startTime updated', { startTime: result });
        }
      } catch (e) {
        logger.error('Error in tick:', e);
        if (e instanceof Error) {
          await incrementErrorCount(e);
        }
      }

      isProcessing = false;
    };

    // Запускаем polling каждые 10 секунд
    logger.info(`🔄 Starting polling every ${config.ton.monitoringInterval / 1000}s`);
    setInterval(tick, config.ton.monitoringInterval);
    tick(); // Первый запуск сразу
  }
}

// ==========================================
// Worker Initialization
// ==========================================

async function startDepositMonitor() {
  try {
    logger.info('🚀 Starting Deposit Monitor Worker...');
    logger.info(`📡 Network: ${config.ton.network}`);
    logger.info(`💰 Monitoring address: ${DEPOSIT_WALLET_ADDRESS}`);
    logger.info(`💎 Min deposit: ${MIN_DEPOSIT_TON} TON`);

    // Проверка наличия Bot Token для уведомлений
    if (!config.telegram.botToken) {
      logger.warn('⚠️ TELEGRAM_BOT_TOKEN not set, notifications will be disabled');
    } else {
      logger.info('✅ Telegram notifications enabled');
    }

    // Проверка конфигурации
    if (!DEPOSIT_WALLET_ADDRESS) {
      throw new Error('TON_DEPOSIT_ADDRESS is not set');
    }

    const apiKey = isMainnet ? config.ton.toncenterMainnetToken : config.ton.toncenterTestnetToken;
    if (!apiKey) {
      throw new Error(`TonCenter API key not set for ${config.ton.network}`);
    }

    logger.info('🔑 API Configuration:', {
      network: config.ton.network,
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey.length,
      apiKeyPreview: apiKey.substring(0, 10) + '...',
      endpoint: isMainnet ? 'https://toncenter.com/api/v2/jsonRPC' : 'https://testnet.toncenter.com/api/v2/jsonRPC'
    });

    // Проверка и нормализация адреса
    let normalizedAddress = DEPOSIT_WALLET_ADDRESS;
    try {
      // TonWeb автоматически нормализует адрес
      const address = new tonweb.utils.Address(DEPOSIT_WALLET_ADDRESS);
      normalizedAddress = address.toString(true, true, false); // user-friendly, bounceable, urlSafe=false
      logger.info('📍 Address normalized:', {
        original: DEPOSIT_WALLET_ADDRESS,
        normalized: normalizedAddress
      });
    } catch (error) {
      logger.error('❌ Invalid TON address format:', { address: DEPOSIT_WALLET_ADDRESS, error });
      throw new Error(`Invalid TON_DEPOSIT_ADDRESS format: ${DEPOSIT_WALLET_ADDRESS}`);
    }

    // Загружаем startTime из БД
    const startTime = await loadStartTime();

    // Создаем и запускаем AccountSubscription
    const accountSubscription = new AccountSubscription(
      tonweb,
      normalizedAddress,
      startTime,
      onTransaction
    );

    await accountSubscription.start();

    logger.info('✅ Deposit Monitor Worker started successfully');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('⏹️ SIGTERM received, shutting down gracefully...');
      await prisma.depositMonitoringState.update({
        where: { id: 'singleton' },
        data: { isRunning: false }
      });
      await prisma.$disconnect();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('⏹️ SIGINT received, shutting down gracefully...');
      await prisma.depositMonitoringState.update({
        where: { id: 'singleton' },
        data: { isRunning: false }
      });
      await prisma.$disconnect();
      process.exit(0);
    });

  } catch (error) {
    logger.error('❌ Failed to start Deposit Monitor Worker:', error);
    process.exit(1);
  }
}

// Запуск worker
startDepositMonitor().catch((error) => {
  logger.error('❌ Unhandled error in Deposit Monitor:', error);
  process.exit(1);
});

