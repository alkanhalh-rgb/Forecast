import { RIYADH_TZ } from './time';

export type Locale = 'ar' | 'en';
export const LOCALES: Locale[] = ['ar', 'en'];
export const DEFAULT_LOCALE: Locale = 'ar';

/**
 * Intl locale tags. Plain "ar-SA" would give Arabic-Indic digits and the Hijri calendar;
 * the spec requires Western numerals and we show Gregorian dates.
 */
export function intlLocale(locale: Locale): string {
  return locale === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB-u-nu-latn-ca-gregory';
}

export function formatNumber(n: number, locale: Locale, opts: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(intlLocale(locale), opts).format(n);
}

export function formatSigned(n: number, locale: Locale): string {
  return formatNumber(n, locale, { signDisplay: 'exceptZero' });
}

export function formatPercent(fraction: number, locale: Locale): string {
  return formatNumber(fraction, locale, { style: 'percent', maximumFractionDigits: 0 });
}

export function formatDateTime(d: Date | string, locale: Locale, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: RIYADH_TZ, ...opts }).format(new Date(d));
}

export function formatTime(d: Date | string, locale: Locale): string {
  return formatDateTime(d, locale, { hour: '2-digit', minute: '2-digit', hour12: false });
}
