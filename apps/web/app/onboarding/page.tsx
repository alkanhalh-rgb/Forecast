'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { SAUDI_CITIES } from '@app/shared';
import { ForecastForm } from '@/components/ForecastForm';
import { ErrorText, PageTitle, Spinner } from '@/components/ui';
import { api, fetcher } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';
import { useSession } from '@/lib/session';
import type { Category, QuestionDto } from '@/lib/types';

const TOTAL = 4;

export default function OnboardingPage() {
  const { t } = useI18n();
  const { me, loading, refresh } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (loading) return;
    if (!me) return router.replace('/login');
    if (me.onboarded) return router.replace('/');
    setStep(!me.ageConfirmed ? 1 : !me.nickname ? 2 : me.interests.length !== 3 ? 3 : 4);
  }, [me, loading, router]);

  if (loading || !me) return <Spinner />;

  return (
    <div className="mx-auto max-w-md">
      <p className="mb-2 text-sm text-muted" aria-live="polite">
        {t('onboarding.step', { n: step, total: TOTAL })}
      </p>
      <div className="mb-6 h-2 rounded-full bg-track" aria-hidden>
        <div className="h-2 rounded-full bg-brand-600" style={{ inlineSize: `${(step / TOTAL) * 100}%` }} />
      </div>
      {step === 1 && <AgeStep onDone={() => refresh()} />}
      {step === 2 && <ProfileStep onDone={() => refresh()} />}
      {step === 3 && <InterestsStep onDone={() => refresh()} />}
      {step === 4 && (
        <WarmupStep
          onDone={async () => {
            await api('/me/onboarding/complete', { method: 'POST' });
            await refresh();
            router.replace(new URLSearchParams(window.location.search).get('next') ?? '/');
          }}
        />
      )}
    </div>
  );
}

function useSubmit(fn: () => Promise<unknown>, onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return {
    busy,
    error,
    run: async (e: React.FormEvent) => {
      e.preventDefault();
      setBusy(true);
      setError(null);
      try {
        await fn();
        onDone();
      } catch (err) {
        setError(err);
      } finally {
        setBusy(false);
      }
    },
  };
}

function AgeStep({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [age, setAge] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const s = useSubmit(() => api('/me/age-consent', { body: { confirm18: age, acceptPrivacy: privacy } }), onDone);
  return (
    <form onSubmit={s.run} className="card space-y-4">
      <PageTitle>{t('onboarding.ageTitle')}</PageTitle>
      <p className="text-sm text-muted">{t('onboarding.privacyNotice')}</p>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="size-5 accent-brand-600" checked={age} onChange={(e) => setAge(e.target.checked)} />
        <span>{t('onboarding.ageConfirm')}</span>
      </label>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="size-5 accent-brand-600" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
        <span>{t('onboarding.privacyAccept')}</span>
      </label>
      <button className="btn-primary w-full" disabled={!age || !privacy || s.busy}>
        {t('common.continue')}
      </button>
      <ErrorText error={s.error} />
    </form>
  );
}

function ProfileStep({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [nickname, setNickname] = useState('');
  const [city, setCity] = useState('riyadh');
  const s = useSubmit(() => api('/me/profile', { body: { nickname, city } }), onDone);
  return (
    <form onSubmit={s.run} className="card space-y-4">
      <PageTitle>{t('onboarding.profileTitle')}</PageTitle>
      <div>
        <label htmlFor="nickname" className="label">
          {t('onboarding.nickname')}
        </label>
        <input id="nickname" className="input" required minLength={3} maxLength={20} value={nickname} onChange={(e) => setNickname(e.target.value)} aria-describedby="nick-hint" />
        <p id="nick-hint" className="mt-1 text-sm text-muted">
          {t('onboarding.nicknameHint')}
        </p>
      </div>
      <div>
        <label htmlFor="city" className="label">
          {t('onboarding.city')}
        </label>
        <select id="city" className="input" value={city} onChange={(e) => setCity(e.target.value)}>
          {SAUDI_CITIES.map((c) => (
            <option key={c} value={c}>
              {t(`cities.${c}`)}
            </option>
          ))}
        </select>
      </div>
      <button className="btn-primary w-full" disabled={s.busy}>
        {t('common.continue')}
      </button>
      <ErrorText error={s.error} />
    </form>
  );
}

function InterestsStep({ onDone }: { onDone: () => void }) {
  const { t, pick } = useI18n();
  const { data } = useSWR<Category[]>('/categories', fetcher);
  const [sel, setSel] = useState<string[]>([]);
  const s = useSubmit(() => api('/me/interests', { body: { interests: sel } }), onDone);
  if (!data) return <Spinner />;
  return (
    <form onSubmit={s.run} className="card space-y-4">
      <PageTitle>{t('onboarding.interestsTitle')}</PageTitle>
      <fieldset>
        <legend className="sr-only">{t('onboarding.interestsTitle')}</legend>
        <div className="flex flex-wrap gap-2">
          {data.map((c) => {
            const on = sel.includes(c.slug);
            return (
              <label key={c.id} className={`chip cursor-pointer ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white'}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  disabled={!on && sel.length >= 3}
                  onChange={() => setSel(on ? sel.filter((x) => x !== c.slug) : [...sel, c.slug])}
                />
                {pick(c, 'name')}
              </label>
            );
          })}
        </div>
      </fieldset>
      <p className="text-sm text-muted" aria-live="polite">
        {t('onboarding.interestsCount', { n: sel.length })}
      </p>
      <button className="btn-primary w-full" disabled={sel.length !== 3 || s.busy}>
        {t('common.continue')}
      </button>
      <ErrorText error={s.error} />
    </form>
  );
}

function WarmupStep({ onDone }: { onDone: () => Promise<void> }) {
  const { t, pick } = useI18n();
  const { data, mutate } = useSWR<QuestionDto[]>('/questions/warmup', fetcher);
  const [busy, setBusy] = useState(false);
  if (!data) return <Spinner />;
  const answered = data.filter((q) => q.myForecast).length;
  const done = answered >= Math.min(3, data.length);
  return (
    <div className="space-y-4">
      <PageTitle>{t('onboarding.warmupTitle')}</PageTitle>
      <p className="text-muted">{data.length ? t('onboarding.warmupIntro') : t('onboarding.warmupNone')}</p>
      {data.length > 0 && (
        <p className="text-sm font-medium" aria-live="polite">
          {t('onboarding.warmupProgress', { n: answered, total: data.length })}
        </p>
      )}
      {data.map((q) => (
        <section key={q.id} className="flex flex-col gap-2" aria-labelledby={`wq-${q.id}`}>
          <h2 id={`wq-${q.id}`} className="px-1 text-lg font-bold">
            {pick(q, 'text')}
          </h2>
          <ForecastForm q={q} onSaved={() => mutate()} />
        </section>
      ))}
      <button
        className="btn-primary w-full"
        disabled={!done || busy}
        onClick={async () => {
          setBusy(true);
          await onDone();
        }}
      >
        {t('onboarding.finish')}
      </button>
    </div>
  );
}
