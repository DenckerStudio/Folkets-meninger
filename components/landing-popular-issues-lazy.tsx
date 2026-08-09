'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Vote } from 'lucide-react';
import { LandingPopularIssues, type LandingIssue } from '@/components/landing-popular-issues';
import { routes } from '@/lib/routes';

function LandingPopularIssuesSkeleton() {
  return (
    <section aria-busy="true" aria-label="Laster populære saker">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-3">
          <div className="h-3 w-24 animate-pulse rounded bg-[#ba0c2f]/15" />
          <div className="h-9 w-64 animate-pulse rounded-lg bg-[#00205b]/10" />
          <div className="h-5 w-full max-w-xl animate-pulse rounded bg-[#00205b]/8" />
        </div>
        <div className="h-5 w-40 animate-pulse rounded bg-[#00205b]/8" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="animate-pulse overflow-hidden rounded-2xl border border-[#00205b]/10 bg-white"
          >
            <div className="space-y-4 p-6">
              <div className="flex justify-between gap-2">
                <div className="h-5 w-24 rounded-full bg-[#00205b]/10" />
                <div className="h-4 w-20 rounded bg-[#00205b]/8" />
              </div>
              <div className="h-6 w-full rounded bg-[#00205b]/10" />
              <div className="h-4 w-full rounded bg-[#00205b]/8" />
              <div className="h-4 w-2/3 rounded bg-[#00205b]/8" />
            </div>
            <div className="border-t border-[#00205b]/8 bg-[#00205b]/[0.02] px-6 py-4">
              <div className="h-1.5 w-full rounded-full bg-[#00205b]/10" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LandingPopularIssuesEmpty() {
  return (
    <section className="rounded-3xl border border-dashed border-[#00205b]/20 bg-gradient-to-br from-[#00205b]/[0.03] via-white to-[#ba0c2f]/[0.04] px-6 py-12 text-center sm:px-10">
      <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#00205b]/[0.06] text-[#00205b]">
        <Vote className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-[#001433]">Bli med å gjøre sakene synlige</h2>
      <p className="mx-auto mt-3 max-w-lg text-[#001433]/65 leading-relaxed">
        Når nok innbyggere stemmer, dukker de mest engasjerende sakene opp her. Logg inn, stem på det du
        bryr deg om — og hjelp andre å se hva som skjer mellom valgene.
      </p>
      <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href={`${routes.login}?next=${encodeURIComponent(routes.utforsk)}`}
          className="inline-flex items-center justify-center rounded-full bg-[#00205b] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ba0c2f]"
        >
          Logg inn og stem
        </Link>
        <Link
          href={`${routes.login}?next=${encodeURIComponent(routes.utforsk)}`}
          className="inline-flex items-center text-sm font-semibold text-[#00205b] transition-colors hover:text-[#ba0c2f]"
        >
          Utforsk åpne saker <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

export function LandingPopularIssuesLazy() {
  const [issues, setIssues] = useState<LandingIssue[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/saker/popular?limit=6')
      .then((res) => {
        if (!res.ok) throw new Error('popular saker failed');
        return res.json();
      })
      .then((data: { issues?: LandingIssue[] }) => {
        if (!cancelled) {
          setIssues(data.issues ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setIssues([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <LandingPopularIssuesSkeleton />;
  }

  if (!issues?.length) {
    return <LandingPopularIssuesEmpty />;
  }

  return <LandingPopularIssues issues={issues.slice(0, 6)} />;
}
