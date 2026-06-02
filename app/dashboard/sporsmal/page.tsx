import Link from 'next/link';
import FadeIn from '@/components/fade-in';
import { PageHeader } from '@/components/page-header';
import { routes } from '@/lib/routes';
import { STORTINGET_ACTIVE_SESSION_ID } from '@/lib/stortinget-config';
import { getSporsmalListe, type SporsmalType } from '@/lib/stortinget';

export const revalidate = 3600;

function typeLabel(t: SporsmalType) {
  if (t === 'sporretimesporsmal') return 'Spørretimespørsmål';
  if (t === 'interpellasjoner') return 'Interpellasjoner';
  return 'Skriftlige spørsmål';
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    besvart: 'Besvart',
    ubesvart: 'Ubesvart',
    under_behandling: 'Under behandling',
    avsluttet: 'Avsluttet',
  };
  return labels[status.toLowerCase()] ?? status.replace(/_/g, ' ');
}

function formatSporsmalType(type: string): string {
  const labels: Record<string, string> = {
    skriftligesporsmal: 'Skriftlig spørsmål',
    sporretimesporsmal: 'Spørretimespørsmål',
    interpellasjoner: 'Interpellasjon',
  };
  return labels[type.toLowerCase()] ?? type.replace(/_/g, ' ');
}

function formatSendtDato(value: unknown): string | null {
  if (!value) return null;
  const raw = String(value);
  const match = raw.match(/\/Date\((\d+)/);
  const date = match ? new Date(parseInt(match[1], 10)) : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function SporsmalPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; sesjonId?: string }>;
}) {
  const sp = await searchParams;
  const type: SporsmalType =
    sp.type === 'interpellasjoner' || sp.type === 'skriftligesporsmal' || sp.type === 'sporretimesporsmal'
      ? sp.type
      : 'skriftligesporsmal';
  const sesjonId = sp.sesjonId || STORTINGET_ACTIVE_SESSION_ID;
  const status = sp.status || '';

  const sporsmal = await getSporsmalListe({
    type,
    sesjonId,
    status: status || undefined,
    nextRevalidateSeconds: 3600,
  });

  return (
    <div className="space-y-8 pb-12">
      <FadeIn delay={0.1}>
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8 md:p-12">
          <PageHeader
            title="Spørsmål"
            description={`Lister spørsmål fra sesjonen ${sesjonId}.`}
          />
        </div>
      </FadeIn>

      <FadeIn delay={0.2} direction="up">
        <div className="flex flex-wrap gap-2">
          {(['skriftligesporsmal', 'sporretimesporsmal', 'interpellasjoner'] as SporsmalType[]).map((t) => {
            const active = t === type;
            const href = `/sporsmal?${new URLSearchParams({
              type: t,
              sesjonId,
              ...(status ? { status } : {}),
            }).toString()}`;
            return (
              <a
                key={t}
                href={href}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {typeLabel(t)}
              </a>
            );
          })}
        </div>
      </FadeIn>

      <FadeIn delay={0.25} direction="up">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="text-sm text-gray-500">{sporsmal.length} treff</div>
            {status ? (
              <span className="text-xs font-medium text-gray-600">Filter: {formatStatus(status)}</span>
            ) : null}
          </div>
          <div className="divide-y divide-gray-100">
            {sporsmal.slice(0, 200).map((q, idx) => {
              const title = (q.tittel as string) || (q.sporsmal as string) || (q.id ? `Spørsmål ${q.id}` : 'Spørsmål');
              const sendt = formatSendtDato(q.sendt_dato);
              const statusLabel = q.status ? formatStatus(String(q.status)) : null;
              const typeLabelText = q.type ? formatSporsmalType(String(q.type)) : null;

              return (
                <div key={(q.id as string) ?? idx} className="px-6 py-4">
                  {q.id ? (
                    <Link
                      href={routes.sporsmalDetail(String(q.id))}
                      className="text-sm font-semibold text-gray-900 hover:text-indigo-600"
                    >
                      {title}
                    </Link>
                  ) : (
                    <div className="text-sm font-semibold text-gray-900">{title}</div>
                  )}
                  {(sendt || statusLabel || typeLabelText) && (
                    <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                      {sendt && <span>Sendt {sendt}</span>}
                      {statusLabel && <span>{statusLabel}</span>}
                      {typeLabelText && <span>{typeLabelText}</span>}
                    </div>
                  )}
                </div>
              );
            })}
            {sporsmal.length > 200 && (
              <div className="px-6 py-4 text-xs text-gray-500">Viser første 200 for ytelse.</div>
            )}
            {sporsmal.length === 0 && <div className="px-6 py-10 text-sm text-gray-500">Ingen data.</div>}
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
