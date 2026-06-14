import FadeIn from '@/components/fade-in';
import Image from 'next/image';
import { STORTINGET_ACTIVE_PERIODE_ID } from '@/lib/stortinget-config';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

type ApiResponse = {
  periode: string;
  representanter: Array<{
    id: string;
    fornavn: string;
    etternavn: string;
    fylke?: { navn?: string };
    parti?: { navn?: string; id?: string };
  }>;
};

export default async function RepresentanterPage() {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || 'http';
  const baseUrl = host ? `${proto}://${host}` : '';

  const res = await fetch(`${baseUrl}/api/representanter?periode=${encodeURIComponent(STORTINGET_ACTIVE_PERIODE_ID)}`, {
    cache: 'no-store',
  });

  const data = (res.ok ? ((await res.json()) as ApiResponse) : null) ?? {
    periode: STORTINGET_ACTIVE_PERIODE_ID,
    representanter: [],
  };

  const sorted = [...data.representanter].sort((a, b) => a.etternavn.localeCompare(b.etternavn, 'no'));

  return (
    <div className="space-y-8 pb-12">
      <FadeIn delay={0.1}>
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8 md:p-12">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl tracking-tight">Representanter</h1>
          <p className="text-gray-600 mt-3">
            Oversikt over alle innvalgte representanter for stortingsperioden <span className="font-semibold">{data.periode}</span>.
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.2} direction="up">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="text-sm text-gray-500">{sorted.length} representanter</div>
          </div>
          <div className="divide-y divide-gray-100">
            {sorted.map((r) => (
              <div key={r.id} className="px-6 py-4 flex items-center gap-4">
                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                  <Image
                    src={`https://data.stortinget.no/eksport/personbilde?personid=${encodeURIComponent(r.id)}&storrelse=lite&erstatningsbilde=true`}
                    alt={`${r.fornavn} ${r.etternavn}`}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-900 truncate">
                    {r.fornavn} {r.etternavn}
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {r.parti?.navn || 'Ukjent parti'} · {r.fylke?.navn || 'Ukjent fylke'}
                  </div>
                </div>
                <div className="text-xs text-gray-400 font-mono">{r.id}</div>
              </div>
            ))}
            {sorted.length === 0 && <div className="px-6 py-10 text-sm text-gray-500">Ingen data.</div>}
          </div>
        </div>
      </FadeIn>
    </div>
  );
}

