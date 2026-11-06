import 'server-only';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, type Locale } from '@app/shared';
import ar from '../messages/ar.json';
import en from '../messages/en.json';

export type Messages = typeof ar;
const DICTS: Record<Locale, Messages> = { ar, en };

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get('locale')?.value;
  return c === 'en' || c === 'ar' ? c : DEFAULT_LOCALE;
}

export function getMessages(locale: Locale): Messages {
  return DICTS[locale];
}
