'use client';
import { useI18n } from '@/lib/i18n-client';
import { PageTitle } from '@/components/ui';

export default function Home() {
  const { t } = useI18n();
  return <PageTitle>{t('feed.title')}</PageTitle>;
}
