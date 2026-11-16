import Link from 'next/link';
import { ArrowRight, Vote } from 'lucide-react';
import { unstable_noStore as noStore } from 'next/cache';
import { LandingPopularIssues } from '@/components/landing-popular-issues';
import { LandingSectionContainer } from '@/components/landing-section-container';
import { fetchLandingPopularIssues } from '@/lib/landing/home-data';
import { routes } from '@/lib/routes';

function LandingPopularIssuesEmpty() {
  return (
    <LandingSectionContainer>
      <section className="rounded-3xl border border-dashed border-[#00205b]/20 bg-gradient-to-br from-[#00205b]/[0.03] via-white to-[#ba0c2f]/[0.04] px-6 py-12 text-center sm:px-10">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#00205b]/[0.06] text-[#00205b]">
          <Vote className="h-6 w-6" aria-hidden />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-[#001433]">Bli med å gjøre sakene synlige</h2>
        <p className="mx-auto mt-3 max-w-lg text-[#001433]/65 leading-relaxed">
          Når nok innbyggere stemmer, dukker sakene opp her.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={routes.login}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#00205b] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ba0c2f]"
          >
            Logg inn og stem
          </Link>
          <Link
            href={routes.utforsk}
            className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-[#00205b] transition-colors hover:text-[#ba0c2f]"
          >
            Utforsk saker <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
      </section>
    </LandingSectionContainer>
  );
}

function LandingPopularIssuesUnavailable() {
  return (
    <LandingSectionContainer>
      <section
        className="rounded-3xl border border-dashed border-[#00205b]/20 bg-white px-6 py-10 text-center sm:px-10"
        role="status"
      >
        <p className="text-sm text-[#001433]/65">Populære saker er midlertidig utilgjengelig. Prøv igjen senere.</p>
        <Link
          href={routes.utforsk}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#00205b] transition-colors hover:text-[#ba0c2f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00205b] focus-visible:ring-offset-2"
        >
          Gå til Utforsk <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
        </Link>
      </section>
    </LandingSectionContainer>
  );
}

export async function LandingPopularIssuesSection() {
  const { issues, failed } = await fetchLandingPopularIssues(6);

  if (failed) {
    noStore();
    return <LandingPopularIssuesUnavailable />;
  }

  if (!issues.length) {
    return <LandingPopularIssuesEmpty />;
  }

  return <LandingPopularIssues issues={issues} />;
}