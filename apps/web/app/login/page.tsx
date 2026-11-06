'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorText, PageTitle } from '@/components/ui';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';
import { useSession } from '@/lib/session';

export default function LoginPage() {
  const { t } = useI18n();
  const { refresh } = useSession();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/auth/request-code', { body: { phone } });
      setSent(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api('/auth/verify', { body: { phone, code } });
      await refresh(res.me, { revalidate: false });
      const next = new URLSearchParams(window.location.search).get('next') ?? '/';
      router.replace(res.me.onboarded ? next : `/onboarding?next=${encodeURIComponent(next)}`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <PageTitle>{t('auth.title')}</PageTitle>
      <p className="mb-6 text-muted">{t('common.free')}</p>
      {!sent ? (
        <form onSubmit={send} className="card space-y-4">
          <div>
            <label htmlFor="phone" className="label">
              {t('auth.phoneLabel')}
            </label>
            <input id="phone" className="input num" dir="ltr" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} aria-describedby="phone-hint" />
            <p id="phone-hint" className="mt-1 text-sm text-muted">
              {t('auth.phoneHint')}
            </p>
          </div>
          <button className="btn-primary w-full" disabled={busy}>
            {t('auth.sendCode')}
          </button>
          <ErrorText error={error} />
          <p className="text-xs text-muted">{t('auth.privacyShort')}</p>
        </form>
      ) : (
        <form onSubmit={verify} className="card space-y-4">
          <p className="text-sm" aria-live="polite">
            {t('auth.codeSent', { phone })}
          </p>
          <div>
            <label htmlFor="code" className="label">
              {t('auth.codeLabel')}
            </label>
            <input id="code" className="input num tracking-widest" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          </div>
          <button className="btn-primary w-full" disabled={busy || code.length !== 6}>
            {t('auth.verify')}
          </button>
          <button type="button" className="btn-secondary w-full" onClick={() => { setSent(false); setCode(''); }}>
            {t('auth.changeNumber')}
          </button>
          <ErrorText error={error} />
        </form>
      )}
    </div>
  );
}
