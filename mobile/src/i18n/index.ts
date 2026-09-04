// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — i18n Configuration
// ═══════════════════════════════════════════════════════════════════

import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en.json';
import es from './es.json';

// ─── Types ──────────────────────────────────────────────────────
export type Locale = 'en' | 'es';
export type TranslationKey = string;

// ─── Translations ───────────────────────────────────────────────
const translations: Record<Locale, typeof en> = {
  en,
  es,
};

// ─── Storage Key ────────────────────────────────────────────────
const LOCALE_STORAGE_KEY = '@el_oraculo_locale';

// ─── Get Device Locale ──────────────────────────────────────────
function getDeviceLocale(): Locale {
  const deviceLocale = Localization.getLocales()[0]?.languageCode || 'en';
  return deviceLocale === 'es' ? 'es' : 'en';
}

// ─── i18n Class ─────────────────────────────────────────────────
class I18n {
  private currentLocale: Locale = 'en';
  private listeners: Array<(locale: Locale) => void> = [];

  /**
   * Initialize i18n (load saved locale or use device default)
   */
  async init(): Promise<Locale> {
    try {
      const saved = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved && (saved === 'en' || saved === 'es')) {
        this.currentLocale = saved;
      } else {
        this.currentLocale = getDeviceLocale();
      }
    } catch {
      this.currentLocale = getDeviceLocale();
    }
    return this.currentLocale;
  }

  /**
   * Get current locale
   */
  getLocale(): Locale {
    return this.currentLocale;
  }

  /**
   * Set locale and save to storage
   */
  async setLocale(locale: Locale): Promise<void> {
    this.currentLocale = locale;
    try {
      await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Storage error, continue
    }
    this.notifyListeners();
  }

  /**
   * Toggle between en/es
   */
  async toggleLocale(): Promise<Locale> {
    const newLocale = this.currentLocale === 'en' ? 'es' : 'en';
    await this.setLocale(newLocale);
    return newLocale;
  }

  /**
   * Translate a key with optional params
   * Usage: t('dashboard.title') or t('emergency.confirmMessage', { coin: 'BTC' })
   */
  t(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value: any = translations[this.currentLocale];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English
        value = translations.en;
        for (const fk of keys) {
          if (value && typeof value === 'object' && fk in value) {
            value = value[fk];
          } else {
            return key; // Return key if not found
          }
        }
        break;
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    // Replace params: {coin} → BTC
    if (params) {
      return Object.entries(params).reduce(
        (str, [k, v]) => str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
        value
      );
    }

    return value;
  }

  /**
   * Subscribe to locale changes
   */
  subscribe(listener: (locale: Locale) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(l => l(this.currentLocale));
  }
}

export const i18n = new I18n();
