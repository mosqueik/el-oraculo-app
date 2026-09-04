// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — useTranslation Hook
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { i18n, Locale } from '../i18n';

export function useTranslation() {
  const [locale, setLocaleState] = useState<Locale>(i18n.getLocale());

  useEffect(() => {
    // Subscribe to locale changes
    const unsubscribe = i18n.subscribe((newLocale) => {
      setLocaleState(newLocale);
    });

    return unsubscribe;
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return i18n.t(key, params);
    },
    [locale] // Re-create when locale changes
  );

  const setLocale = useCallback(async (newLocale: Locale) => {
    await i18n.setLocale(newLocale);
  }, []);

  const toggleLocale = useCallback(async () => {
    await i18n.toggleLocale();
  }, []);

  return {
    t,
    locale,
    setLocale,
    toggleLocale,
    isSpanish: locale === 'es',
    isEnglish: locale === 'en',
  };
}
