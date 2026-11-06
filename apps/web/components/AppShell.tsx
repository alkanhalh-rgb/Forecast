'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useI18n } from '@/lib/i18n-client';
import { isStaff, SessionProvider, useSession } from '@/lib/session';
import { ServiceWorker } from './ServiceWorker';

export function AppShell({ children, socketUrl }: { children: React.ReactNode; socketUrl: string }) {
  return (
    <SessionProvider socketUrl={socketUrl}>
      <Shell>{children}</Shell>
      <ServiceWorker />
    </SessionProvider>
  );
}

const OPEN_PATHS = ['/login', '/onboarding', '/privacy'];

function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { me, loading } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || !me) return;
    if (!me.onboarded && !OPEN_PATHS.some((p) => pathname.startsWith(p))) router.replace(`/onboarding?next=${encodeURIComponent(pathname)}`);
  }, [me, loading, pathname, router]);

  const nav = [
    { href: '/', label: t('nav.feed'), icon: '◎' },
    { href: '/league', label: t('nav.leagues'), icon: '▲' },
    { href: '/duels', label: t('nav.duels'), icon: '⚔' },
    { href: '/friends', label: t('nav.friends'), icon: '☺' },
    { href: '/me', label: t('nav.me'), icon: '●' },
  ];
  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:p-2">
        {t('common.skipToContent')}
      </a>
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-white/95 px-4 py-3 backdrop-blur">
        <Link href="/" className="text-xl font-bold text-brand-700">
          {t('common.appName')}
        </Link>
        <div className="flex items-center gap-2">
          {isStaff(me) && (
            <Link href="/admin" className="btn-secondary text-sm">
              {t('nav.admin')}
            </Link>
          )}
          <Link href="/leaderboards" className="btn-secondary text-sm">
            {t('nav.leaderboards')}
          </Link>
          <LanguageToggle />
          {!me && !loading && (
            <Link href="/login" className="btn-primary text-sm">
              {t('nav.login')}
            </Link>
          )}
        </div>
      </header>
      <main id="main" className="flex-1 px-4 pb-28 pt-4">
        {children}
      </main>
      {me?.onboarded && (
        <nav aria-label={t('nav.main')} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white">
          <ul className="mx-auto flex max-w-2xl justify-around">
            {nav.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active(n.href) ? 'page' : undefined}
                  className={`flex min-h-14 min-w-16 flex-col items-center justify-center gap-0.5 px-2 text-xs font-medium ${active(n.href) ? 'text-brand-700' : 'text-muted'}`}
                >
                  <span aria-hidden className="text-lg leading-none">
                    {n.icon}
                  </span>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

function LanguageToggle() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const next = locale === 'ar' ? 'en' : 'ar';
  return (
    <button
      type="button"
      className="btn-secondary text-sm"
      aria-label={t('nav.switchLanguageLabel')}
      lang={next}
      onClick={() => {
        document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
    >
      {t('nav.switchLanguage')}
    </button>
  );
}
