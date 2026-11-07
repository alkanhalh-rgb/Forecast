'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { riyadhHour } from '@app/shared';
import { useI18n } from '@/lib/i18n-client';
import { isStaff, SessionProvider, useSession } from '@/lib/session';
import { Icon } from './Icon';
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
    { href: '/', label: t('nav.feed'), icon: 'home' },
    { href: '/league', label: t('nav.leagues'), icon: 'league' },
    { href: '/duels', label: t('nav.duels'), icon: 'duel' },
    { href: '/friends', label: t('nav.friends'), icon: 'friends' },
    { href: '/me', label: t('nav.me'), icon: 'user' },
  ];
  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const greeting = riyadhHour(new Date()) < 12 ? t('home.greetingMorning') : t('home.greetingEvening');
  const initials = (me?.nickname ?? '').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase();
  const iconBtn = 'flex size-11 items-center justify-center rounded-2xl border border-line bg-surface text-ink hover:bg-soft';

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:p-2">
        {t('common.skipToContent')}
      </a>
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-canvas/95 px-4 pb-3 pt-4 backdrop-blur">
        {me?.nickname ? (
          <Link href="/me" className="flex min-w-0 items-center gap-3">
            <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-600 font-bold text-white">
              {initials}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-xs text-muted">{greeting}</span>
              <bdi className="truncate text-lg font-bold">{me.nickname}</bdi>
            </span>
          </Link>
        ) : (
          <Link href="/" className="text-2xl font-bold text-brand-600">
            {t('common.appName')}
          </Link>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {isStaff(me) && (
            <Link href="/admin" className={iconBtn} aria-label={t('nav.admin')} title={t('nav.admin')}>
              <Icon name="admin" />
            </Link>
          )}
          <Link href="/leaderboards" className={iconBtn} aria-label={t('nav.leaderboards')} title={t('nav.leaderboards')}>
            <Icon name="rankings" />
          </Link>
          <LanguageToggle />
          {me ? (
            <Link href="/me#notif-h" className={iconBtn} aria-label={t('home.notifications')} title={t('home.notifications')}>
              <Icon name="bell" />
            </Link>
          ) : (
            !loading && (
              <Link href="/login" className="btn-primary text-sm">
                {t('nav.login')}
              </Link>
            )
          )}
        </div>
      </header>
      <main id="main" className="flex-1 px-4 pb-32 pt-2">
        {children}
      </main>
      {me?.onboarded && (
        <nav aria-label={t('nav.main')} className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4">
          <ul className="mx-auto flex max-w-2xl justify-between gap-1 rounded-[22px] bg-ink p-2 shadow-lg">
            {nav.map((n) => (
              <li key={n.href} className="flex-1">
                <Link
                  href={n.href}
                  aria-current={active(n.href) ? 'page' : undefined}
                  className={`flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[11px] ${active(n.href) ? 'bg-white font-bold text-ink' : 'text-[#dce6e2] hover:bg-white/10'}`}
                >
                  <Icon name={n.icon} />
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
      className="h-11 rounded-2xl border border-line bg-surface px-3 text-sm font-semibold hover:bg-soft"
      title={t('nav.switchLanguageLabel')}
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
