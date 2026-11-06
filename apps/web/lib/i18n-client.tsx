'use client';
import { createContext, useCallback, useContext, useMemo } from 'react';
import { formatDateTime, formatNumber, formatPercent, formatSigned, formatTime, type Locale } from '@app/shared';
import { translate, type Dict } from './translate';

interface I18nValue {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  t: (key: string, params?: Record<string, string | number>) => string;
  n: (v: number) => string;
  signed: (v: number) => string;
  pct: (fraction: number) => string;
  dt: (d: Date | string) => string;
  time: (d: Date | string) => string;
  /** pick the Arabic or English field of a bilingual record */
  pick: (o: object, base: string) => string;
}

const Ctx = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Dict; children: React.ReactNode }) {
  const t = useCallback((k: string, p?: Record<string, string | number>) => translate(messages, k, p), [messages]);
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir: locale === 'ar' ? 'rtl' : 'ltr',
      t,
      n: (v) => formatNumber(v, locale),
      signed: (v) => formatSigned(v, locale),
      pct: (f) => formatPercent(f, locale),
      dt: (d) => formatDateTime(d, locale),
      time: (d) => formatTime(d, locale),
      pick: (o, base) => String((o as Record<string, unknown>)[`${base}${locale === 'ar' ? 'Ar' : 'En'}`] ?? ''),
    }),
    [locale, t],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside provider');
  return v;
}
