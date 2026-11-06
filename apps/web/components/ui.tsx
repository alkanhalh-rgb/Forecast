'use client';
import { useI18n } from '@/lib/i18n-client';
import { ApiError } from '@/lib/api';

export function ErrorText({ error }: { error: unknown }) {
  const { t } = useI18n();
  if (!error) return null;
  const code = error instanceof ApiError ? error.code : 'ERROR';
  const msg = t(`errors.${code}`);
  return (
    <p role="alert" className="mt-2 text-sm font-medium text-bad">
      {msg.startsWith('errors.') ? t('errors.ERROR') : msg}
    </p>
  );
}

export function Spinner() {
  const { t } = useI18n();
  return (
    <p role="status" className="py-8 text-center text-muted">
      {t('common.loading')}
    </p>
  );
}

export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="mb-4 text-2xl font-bold">{children}</h1>;
}

/** Wraps LTR fragments (numbers, nicknames with Latin letters) inside RTL text. */
export function Bdi({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <bdi className={`num ${className}`}>{children}</bdi>;
}
