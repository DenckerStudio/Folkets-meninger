'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, MessageSquare, Play, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import type { ForumPrompt } from '@/lib/forum/prompt-queries';
import { filterReelVoteOptions } from '@/lib/forum/prompt-vote-options';
import { getPromptPrimaryMedia, getPromptSourceDateRange } from '@/lib/forum/prompt-source';
import { routes } from '@/lib/routes';

type ForumPromptCarouselProps = {
  prompts: ForumPrompt[];
  title?: string;
  showHeader?: boolean;
  showSeeAll?: boolean;
};

export default function ForumPromptCarousel({
  prompts,
  title = 'Spesielle saker',
  showHeader = true,
  showSeeAll = true,
}: ForumPromptCarouselProps) {
  if (prompts.length === 0) return null;

  return (
    <section className="mb-6" aria-label="Spesielle saker">
      {showHeader ? (
        <div className="flex items-center justify-between gap-3 mb-3 px-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{title}</h2>
          </div>
          {showSeeAll ? (
            <Link
              href={routes.forumSpesielleSaker}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-600"
            >
              Se alle →
            </Link>
          ) : null}
        </div>
      ) : null}
      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 scrollbar-thin">
        {prompts.map((prompt) => (
          <PromptReelCard key={prompt.id} prompt={prompt} />
        ))}
      </div>
    </section>
  );
}

function PromptReelCard({ prompt }: { prompt: ForumPrompt }) {
  const { user } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState(prompt.userVote);
  const [options, setOptions] = useState(() => filterReelVoteOptions(prompt.options));
  const [discussCount, setDiscussCount] = useState(prompt.discussClickCount);
  const [spawnedThreadId, setSpawnedThreadId] = useState(prompt.spawnedThreadId);
  const [discussClicked, setDiscussClicked] = useState(prompt.userDiscussClicked);
  const [loading, setLoading] = useState<'vote' | 'discuss' | null>(null);
  const [error, setError] = useState('');
  const [mediaError, setMediaError] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);

  const hasVoted = !!selected;
  const media = getPromptPrimaryMedia(prompt.sources);
  const dateRange = getPromptSourceDateRange(prompt.sources);
  const sourceChipLimit = 5;
  const visibleSources = sourcesExpanded
    ? prompt.sources
    : prompt.sources.slice(0, sourceChipLimit);
  const hiddenSourceCount = Math.max(0, prompt.sources.length - sourceChipLimit);
  const isUpdate = prompt.topicTags?.includes('oppdatering');
  const handleVote = async (optionId: string) => {
    if (!user || loading) return;
    setLoading('vote');
    setError('');

    try {
      const res = await fetch('/api/forum/prompt-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_id: prompt.id, option_id: optionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Kunne ikke stemme');
        return;
      }
      setSelected(optionId);
      if (data.options) setOptions(filterReelVoteOptions(data.options));
      router.refresh();
    } catch {
      setError('En feil oppstod');
    } finally {
      setLoading(null);
    }
  };

  const handleDiscuss = async () => {
    if (!user || loading || discussClicked) return;
    setLoading('discuss');
    setError('');

    try {
      const res = await fetch('/api/forum/prompt-discuss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_id: prompt.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Kunne ikke registrere');
        return;
      }
      setDiscussClicked(true);
      setDiscussCount(data.click_count ?? discussCount + 1);
      if (data.spawned_thread_id) setSpawnedThreadId(data.spawned_thread_id);
      router.refresh();
    } catch {
      setError('En feil oppstod');
    } finally {
      setLoading(null);
    }
  };

  return (
    <article className="snap-center shrink-0 w-[min(100%,300px)] sm:w-[320px] flex flex-col rounded-2xl border border-indigo-100 bg-gradient-to-b from-white to-indigo-50/40 shadow-sm overflow-hidden">
      {media && !mediaError && (
        <div className="relative aspect-[4/5] max-h-[220px] w-full bg-gray-900 shrink-0">
          {media.type === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.url}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => setMediaError(true)}
            />
          ) : (
            <a
              href={media.articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-full w-full items-center justify-center bg-gray-900"
            >
              {media.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={media.posterUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-80"
                  referrerPolicy="no-referrer"
                  onError={() => setMediaError(true)}
                />
              ) : null}
              <span className="relative z-10 flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-white">
                <Play className="w-5 h-5 fill-white" />
                Se video
              </span>
            </a>
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        {prompt.stortingetIssueId && (
          <Link
            href={routes.sak(prompt.stortingetIssueId)}
            className="mb-2 inline-flex w-fit items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 hover:bg-amber-200"
          >
            Langvarig stortingssak
          </Link>
        )}

        {isUpdate && (
          <span className="mb-2 inline-flex w-fit items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-800">
            Oppdatering
          </span>
        )}

        {prompt.sources.length > 0 && (
          <div className="mb-3">
            {dateRange && (
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                {dateRange}
              </p>
            )}
            <div className="flex flex-wrap gap-1" role="list" aria-label="Kilder">
              {visibleSources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={source.title}
                  role="listitem"
                  className="inline-flex max-w-[7.5rem] truncate rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {source.outlet}
                </a>
              ))}
              {hiddenSourceCount > 0 && !sourcesExpanded && (
                <button
                  type="button"
                  onClick={() => setSourcesExpanded(true)}
                  className="inline-flex rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 hover:border-indigo-200 hover:bg-indigo-50"
                  aria-expanded={false}
                >
                  +{hiddenSourceCount}
                </button>
              )}
              {sourcesExpanded && prompt.sources.length > sourceChipLimit && (
                <button
                  type="button"
                  onClick={() => setSourcesExpanded(false)}
                  className="inline-flex rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  aria-expanded={true}
                >
                  Færre
                </button>
              )}
            </div>
          </div>
        )}

        <p className="text-base font-bold text-gray-900 leading-snug mb-4">{prompt.question}</p>

        {!hasVoted ? (
          <div className="grid grid-cols-2 gap-2">
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={!user || loading === 'vote'}
                onClick={() => handleVote(opt.id)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50 transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {options.map((opt) => (
              <div key={opt.id}>
                <div className="flex justify-between text-xs font-medium text-gray-700 mb-1">
                  <span className={selected === opt.id ? 'text-indigo-700' : ''}>{opt.label}</span>
                  <span>{opt.percent ?? 0}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${selected === opt.id ? 'bg-indigo-600' : 'bg-indigo-300'}`}
                    style={{ width: `${opt.percent ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {!user && (
          <p className="mt-3 text-xs text-gray-500">
            <Link href={routes.login} className="text-indigo-600 font-medium hover:underline">
              Logg inn
            </Link>{' '}
            for å stemme
          </p>
        )}

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        {hasVoted && (
          <div className="mt-4 pt-4 border-t border-indigo-100">
            {spawnedThreadId ? (
              <Link
                href={routes.forumTopic(spawnedThreadId)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:text-indigo-600"
              >
                <MessageSquare className="w-4 h-4" />
                Bli med i diskusjon →
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleDiscuss}
                  disabled={!user || discussClicked || loading === 'discuss'}
                  className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loading === 'discuss' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MessageSquare className="w-4 h-4" />
                  )}
                  {discussClicked ? 'Du er med!' : 'Start diskusjon'}
                </button>
                <p className="mt-2 text-xs text-gray-500">
                  {discussCount}/{prompt.discussThreshold} ønsker felles diskusjon
                </p>
              </>
            )}
          </div>
        )}

      </div>
    </article>
  );
}
