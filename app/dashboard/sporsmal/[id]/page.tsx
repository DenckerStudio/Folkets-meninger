import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { STORTINGET_ACTIVE_SESSION_ID } from '@/lib/stortinget-config';
import { headers } from 'next/headers';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

async function fetchQuestion(id: string) {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || 'http';
  const baseUrl = host ? `${proto}://${host}` : '';

  for (const type of ['skriftligesporsmal', 'sporretimesporsmal', 'interpellasjoner'] as const) {
    const qs = new URLSearchParams({ type, sesjonId: STORTINGET_ACTIVE_SESSION_ID });
    const res = await fetch(`${baseUrl}/api/sporsmal?${qs}`, { cache: 'no-store' });
    if (!res.ok) continue;
    const data = await res.json();
    const match = (data.sporsmal || []).find((q: { id?: string | number }) => String(q.id) === String(id));
    if (match) return match;
  }
  return null;
}

export default async function SporsmalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const question = await fetchQuestion(id);

  if (!question) {
    notFound();
  }

  const title = question.tittel || question.sporsmal || `Spørsmål ${id}`;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <Link href={routes.sporsmal} className="inline-flex items-center text-indigo-600 font-medium text-sm">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Tilbake til spørsmål
      </Link>

      <article className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {question.status && (
          <p className="text-sm text-gray-500 mt-2">Status: {question.status}</p>
        )}
        <Link
          href={routes.forumNew()}
          className="inline-flex mt-6 text-sm font-semibold text-indigo-600 hover:text-indigo-500"
        >
          Diskuter i forum →
        </Link>
      </article>
    </div>
  );
}
