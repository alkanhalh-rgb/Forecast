import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PLATFORM_NAME_AR, PLATFORM_NAME_EN } from '@app/shared';
import { I18nProvider } from '@/lib/i18n-client';
import { getLocale, getMessages } from '@/lib/i18n';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: `${PLATFORM_NAME_AR} | ${PLATFORM_NAME_EN}`,
  description: 'منصة توقعات مجانية — Free forecasting platform',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
};

export const viewport: Viewport = { themeColor: '#047857', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const socketUrl = process.env.PUBLIC_SOCKET_URL ?? '';
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body>
        <I18nProvider locale={locale} messages={messages}>
          <AppShell socketUrl={socketUrl}>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
