import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Landmark } from 'lucide-react';
import Image from 'next/image';
import { getPolitikereOversikt } from '@/lib/stortinget';
import { getPersonbildeUrl } from '@/lib/stortinget-utils';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export default async function PolitikerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const politikere = await getPolitikereOversikt();
  const rep = politikere.find((r) => String(r.id) === String(id));

  if (!rep) {
    notFound();
  }

  const roleLabel = rep.tittel || 'Stortingsrepresentant';
  const locationLabel = rep.departement || rep.fylke.navn;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <Link href={routes.politikere} className="inline-flex items-center text-indigo-600 font-medium text-sm">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Tilbake til politikere
      </Link>

      <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm flex flex-col sm:flex-row gap-6 items-start">
        <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-gray-100 shrink-0">
          <Image
            src={getPersonbildeUrl(rep.id, 'stort', true)}
            alt={`${rep.fornavn} ${rep.etternavn}`}
            fill
            className="object-cover"
            sizes="96px"
          />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {rep.fornavn} {rep.etternavn}
          </h1>
          <p className="text-gray-600 mt-1 flex items-center gap-1.5">
            {rep.erRegjeringsmedlem && <Landmark className="w-4 h-4 text-amber-600" />}
            {roleLabel}
          </p>
          <p className="text-gray-500 text-sm mt-1">
            {rep.parti.navn} · {locationLabel}
          </p>
          <Link
            href={routes.forum}
            className="inline-flex mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            Diskuter i forum →
          </Link>
        </div>
      </div>
    </div>
  );
}
