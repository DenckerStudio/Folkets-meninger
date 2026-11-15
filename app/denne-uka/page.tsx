import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { WeeklyOverviewSections } from '@/components/weekly-overview/weekly-overview-sections';
import { buildEmptyWeeklyOverview, buildWeeklyOverview } from '@/lib/weekly-overview';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { touchTargetLinkClass } from '@/lib/touch-target';

export const revalidate = 3600;

export const metadata = buildPageMetadata({
  title: 'Dette skjer nå',
  description:
    'Ukentlig offentlig oversikt: saker nær votering, åpne høringsfrister, oppdaterte sammendrag og antall nye skriftlige spørsmål fra Stortinget.',
  canonicalPath: '/denne-uka',
});

export default async function DenneUkaPage() {
  let overview: Awaited<ReturnType<typeof buildWeeklyOverview>>;
  try {
    overview = await buildWeeklyOverview();
  } catch (error) {
    console.error('denne-uka: buildWeeklyOverview failed', error);
    overview = buildEmptyWeeklyOverview();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 pb-14 pt-6 sm:px-6">
      <header className="space-y-4">
        <Link
          href={routes.home}
          className={cn(
            touchTargetLinkClass,
            '-ml-1 inline-flex items-center gap-1 rounded-md px-1 text-sm font-medium text-brand hover:underline',
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Forside
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Ukeoversikt</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Dette skjer nå
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          Offentlig Stortinget-materiale for perioden {overview.window.label}. Ingen persondata, ingen
          brukerstemmer — bare en grunn til å komme tilbake og følge med.
        </p>
      </header>

      <WeeklyOverviewSections overview={overview} />
    </div>
  );
}