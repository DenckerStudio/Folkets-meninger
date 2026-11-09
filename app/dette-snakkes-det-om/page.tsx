import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PublicResearchTopicCard } from '@/components/research-topics/public-research-topic-card';
import { listPublicResearchTopics } from '@/lib/research-topics/public-service';
import { buildPublicResearchTopicsIndexMetadata } from '@/lib/research-topics/public-metadata';
import { routes } from '@/lib/routes';

export const metadata = buildPublicResearchTopicsIndexMetadata();

export const dynamic = 'force-dynamic';

export default async function DetteSnakkesDetOmPage() {
  const topics = await listPublicResearchTopics(24);

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <Link
          href={routes.home}
          className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-sm font-medium text-[#00205b] hover:text-[#ba0c2f] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Forside
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ba0c2f]">
          Samfunnsdebatt
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-[#001433] sm:text-5xl">
          Dette snakkes det om
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-[#001433]/65">
          Her finner du temaer vi har kartlagt ut fra offentlige kilder — med regler, partiforslag,
          medier og meningsmålinger.
        </p>
      </div>

      {topics.length === 0 ? (
        <section
          className="rounded-3xl border border-dashed border-[#00205b]/20 bg-white px-6 py-14 text-center"
          role="status"
        >
          <p className="text-[#001433]/70">Ingen publiserte temaer ennå.</p>
          <p className="mt-2 text-sm text-[#001433]/55">
            Når et tema er ferdig kartlagt og klart for publisering, vises det her.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 items-stretch">
          {topics.map((topic) => (
            <PublicResearchTopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      )}
    </div>
  );
}
