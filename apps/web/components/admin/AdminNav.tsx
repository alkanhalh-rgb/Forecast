'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n-client';
import { isStaff, useSession } from '@/lib/session';
import { Spinner } from '../ui';

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { me, loading } = useSession();
  const path = usePathname();
  if (loading) return <Spinner />;
  if (!isStaff(me)) return <p className="card">{t('errors.FORBIDDEN')}</p>;
  const links: [string, string][] = [
    ['/admin', t('admin.questions')],
    ['/admin/new', t('admin.new')],
    ['/admin/disputes', t('admin.disputes')],
    ['/admin/audit', t('admin.audit')],
  ];
  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold">{t('admin.title')}</h1>
      <nav aria-label={t('admin.title')} className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={path === href ? 'page' : undefined}
            className={`chip shrink-0 ${path === href ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white'}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
