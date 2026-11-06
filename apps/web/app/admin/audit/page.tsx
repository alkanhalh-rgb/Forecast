'use client';
import Link from 'next/link';
import useSWR from 'swr';
import { Spinner } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';

export default function AuditPage() {
  const { dt } = useI18n();
  const { data } = useSWR<any[]>('/admin/audit', fetcher);
  if (!data) return <Spinner />;
  return (
    <ol className="card space-y-2 text-sm">
      {data.map((a) => (
        <li key={a.id} className="num border-b border-line pb-2 last:border-0">
          <span className="text-muted">{dt(a.createdAt)}</span> · <code>{a.action}</code> ·{' '}
          {a.entity === 'Question' ? (
            <Link className="text-brand-700 underline" href={`/admin/q/${a.entityId}`}>
              {a.entityId}
            </Link>
          ) : (
            <span>
              {a.entity}:{a.entityId}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
