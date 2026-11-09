'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LandingResearchTopics } from '@/components/research-topics/landing-research-topics';
import { LandingSectionContainer } from '@/components/landing-section-container';
import type { PublicResearchTopicListItem } from '@/lib/research-topics/public-map';
import { routes } from '@/lib/routes';

function LandingResearchTopicsSkeleton() {
  return (
    <LandingSectionContainer>
      <section aria-busy="true" aria-label="Laster temaer" className="min-h-[22rem]">
        <div className="mb-8 space-y-3">
          <div className="h-3 w-32 animate-pulse rounded bg-[#ba0c2f]/15" />
          <div className="h-9 w-72 animate-pulse rounded-lg bg-[#00205b]/10" />
          <div className="h-5 w-64 max-w-xl animate-pulse rounded bg-[#00205b]/8" />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-2xl border border-[#00205b]/10 bg-white p-6"
            >
              <div className="mb-4 h-5 w-16 rounded bg-[#00205b]/10" />
              <div className="mb-3 h-6 w-full rounded bg-[#00205b]/10" />
              <div className="h-4 w-full rounded bg-[#00205b]/8" />
              <div className="mt-2 h-4 w-2/3 rounded bg-[#00205b]/8" />
            </div>
          ))}
        </div>
      </section>
    </LandingSectionContainer>
  );
}

function LandingResearchTopicsEmpty() {
  return null;
}

function LandingResearchTopicsError() {
  return (
    <LandingSectionContainer>
      <section
        className="rounded-3xl border border-dashed border-[#00205b]/20 bg-white px-6 py-10 text-center sm:px-10"
        role="status"
      >
        <p className="text-sm text-[#001433]/65">
          Temaoversikten er midlertidig utilgjengelig. Prøv igjen senere.
        </p>
        <Link
          href={routes.detteSnakkesDetOm}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#00205b] hover:text-[#ba0c2f]"
        >
          Gå til temaoversikten <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
        </Link>
      </section>
    </LandingSectionContainer>
  );
}

export function LandingResearchTopicsLazy() {
  const [topics, setTopics] = useState<PublicResearchTopicListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/public/research-topics?limit=3')
      .then((res) => {
        if (!res.ok) throw new Error('research topics failed');
        return res.json();
      })
      .then((data: { topics?: PublicResearchTopicListItem[] }) => {
        if (!cancelled) {
          setTopics(data.topics ?? []);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTopics([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <LandingResearchTopicsSkeleton />;
  }

  if (failed) {
    return <LandingResearchTopicsError />;
  }

  if (!topics?.length) {
    return <LandingResearchTopicsEmpty />;
  }

  return <LandingResearchTopics topics={topics.slice(0, 3)} />;
}
