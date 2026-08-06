'use client';

import { useEffect, useState } from 'react';
import { LandingPopularIssues, type LandingIssue } from '@/components/landing-popular-issues';

function LandingPopularIssuesSkeleton() {
  return (
    <section aria-busy="true" aria-label="Laster populære saker">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div className="space-y-3">
          <div className="h-3 w-24 bg-[#ba0c2f]/15 rounded animate-pulse" />
          <div className="h-9 w-64 bg-[#00205b]/10 rounded-lg animate-pulse" />
          <div className="h-5 w-full max-w-xl bg-[#00205b]/8 rounded animate-pulse" />
        </div>
        <div className="h-5 w-40 bg-[#00205b]/8 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-[#00205b]/10 bg-white overflow-hidden animate-pulse"
          >
            <div className="p-6 space-y-4">
              <div className="flex justify-between gap-2">
                <div className="h-5 w-24 bg-[#00205b]/10 rounded-full" />
                <div className="h-4 w-20 bg-[#00205b]/8 rounded" />
              </div>
              <div className="h-6 w-full bg-[#00205b]/10 rounded" />
              <div className="h-4 w-full bg-[#00205b]/8 rounded" />
              <div className="h-4 w-2/3 bg-[#00205b]/8 rounded" />
            </div>
            <div className="bg-[#00205b]/[0.02] px-6 py-4 border-t border-[#00205b]/8">
              <div className="h-1.5 w-full bg-[#00205b]/10 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LandingPopularIssuesLazy() {
  const [issues, setIssues] = useState<LandingIssue[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/saker/popular?limit=10')
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
        if (!cancelled) setError(true);
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

  if (error) {
    return null;
  }

  if (!issues?.length) {
    return (
      <section className="text-center py-8 text-[#001433]/65">
        <h2 className="text-2xl font-bold text-[#001433] mb-2">Populære saker nå</h2>
        <p>Populære saker vises her når listen er synkronisert. Utforsk alle saker etter innlogging.</p>
      </section>
    );
  }

  return <LandingPopularIssues issues={issues} />;
}
