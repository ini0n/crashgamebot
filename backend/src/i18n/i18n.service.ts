// Internationalization service
import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

type TranslationParams = Record<string, string | number>;

export class I18nService {
  private translations: Record<string, any> = {};
  private defaultLanguage = 'ru';
  private supportedLanguages = ['ru', 'en'];

  constructor() {
    this.loadTranslations();
  }

  /**
   * Загружает переводы из файлов
   */
  private loadTranslations(): void {
    try {
      for (const lang of this.supportedLanguages) {
        const filePath = join(__dirname, 'locales', `${lang}.json`);
        const content = readFileSync(filePath, 'utf-8');
        this.translations[lang] = JSON.parse(content);
      }
      
      logger.info('Translations loaded:', {
        languages: this.supportedLanguages
      });
    } catch (error) {
      logger.error('Failed to load translations:', error);
      throw error;
    }
  }

  /**
   * Получает перевод по ключу
   * @param key - ключ перевода (например, 'welcome.title')
   * @param params - параметры для подстановки {name}
   * @param language - оригинальный tg_lang_code из БД (например, 'uk', 'be', 'fr')
   */
  public t(key: string, params?: TranslationParams, language?: string): string {
    const lang = this.normalizeLanguage(language || this.defaultLanguage);
    const translation = this.getNestedValue(this.translations[lang], key);
    
    if (!translation) {
      // Fallback на дефолтный язык
      const fallback = this.getNestedValue(this.translations[this.defaultLanguage], key);
      if (!fallback) {
        logger.warn('Missing translation:', { key, language: lang });
        return key; // Возвращаем ключ если перевод не найден
      }
      return this.interpolate(fallback, params);
    }
    
    return this.interpolate(translation, params);
  }

  /**
   * Нормализует язык к поддерживаемому для переводов
   */
  private normalizeLanguage(language: string): string {
    if (!language) return this.defaultLanguage;
    
    // Telegram может отправлять 'ru-RU', нам нужно 'ru'
    const normalizedLang = language.toLowerCase().split('-')[0];
    
    // Языки для русского перевода
    const russianLanguages = ['ru', 'be', 'uk', 'uz', 'sr', 'kk'];
    
    if (russianLanguages.includes(normalizedLang)) {
      return 'ru';
    }
    
    // Все остальные языки получают английский перевод
    return 'en';
  }

  /**
   * Получает значение по вложенному ключу (например, 'welcome.title')
   */
  private getNestedValue(obj: any, key: string): string | null {
    const keys = key.split('.');
    let current = obj;
    
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return null;
      }
    }
    
    return typeof current === 'string' ? current : null;
  }

  /**
   * Интерполяция параметров в строку
   */
  private interpolate(template: string, params?: TranslationParams): string {
    if (!params) return template;
    
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key]?.toString() || match;
    });
  }

}

// Singleton instance
export const i18nService = new I18nService();
