// Main menu inline keyboard
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

/**
 * Главное меню с inline кнопками
 */
export function getMainMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: '🎮 Играть',
          web_app: {
            url: getWebAppUrl()
          }
        }
      ],
      [
        {
          text: '📢 Наш канал',
          url: getChannelUrl()
        },
        {
          text: '💰 Пополнение',
          web_app: {
            url: getWebAppUrl('/balance')
          }
        }
      ]
    ]
  };
}

/**
 * Получить URL для WebApp
 */
function getWebAppUrl(path: string = ''): string {
  // Импорт config внутри функции для избежания циклических зависимостей
  const { config } = require('../../config/config');
  return `${config.telegram.webAppUrl}${path}`;
}

/**
 * Получить URL канала
 */
function getChannelUrl(): string {
  const { config } = require('../../config/config');
  return config.telegram.channelUrl;
}
