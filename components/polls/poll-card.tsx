'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle, LogIn, Minus, ThumbsDown, ThumbsUp } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { routes } from '@/lib/routes';
import { pollChoicePercent } from '@/lib/polls/format';
import type { PollArgument, PollChoice, PollRecord, PollTotals, PollTopArguments } from '@/lib/polls/types';
import { cn } from '@/lib/utils';

type PollCardProps = {
  poll: PollRecord;
  initialTotals?: PollTotals;
  initialArguments?: PollTopArguments;
  compact?: boolean;
};

const EMPTY_TOTALS: PollTotals = { ja: 0, nei: 0, blank: 0, total: 0 };

function ArgumentList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: 'ja' | 'nei';
  items: PollArgument[];
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        tone === 'ja' ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60',
      )}
    >
      <p
        className={cn(
          'mb-2 text-xs font-semibold uppercase tracking-wide',
          tone === 'ja' ? 'text-emerald-800' : 'text-rose-800',
        )}
      >
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">Ingen fremtredende argumenter ennå.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="text-sm text-gray-800">
              <p className="leading-snug">{item.body}</p>
              <p className="mt-1 text-xs text-gray-500">
                {item.authorName || 'Deltaker'} · {item.likeCount} likes
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PollCard({
  poll,
  initialTotals = EMPTY_TOTALS,
  initialArguments = { ja: [], nei: [] },
  compact = false,
}: PollCardProps) {
  const { user } = useAuth();
  const [totals, setTotals] = useState(initialTotals);
  const [topArgs, setTopArgs] = useState(initialArguments);
  const [userVote, setUserVote] = useState<PollChoice | null>(null);
  const [votingOpen, setVotingOpen] = useState(poll.status === 'open');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/polls?pollId=${encodeURIComponent(poll.id)}`);
        const data = await res.json();
        if (cancelled || !res.ok) return;
        if (data.totals) setTotals(data.totals);
        if (data.arguments) setTopArgs(data.arguments);
        if (data.userVote) setUserVote(data.userVote);
        if (typeof data.votingOpen === 'boolean') setVotingOpen(data.votingOpen);
      } catch {
        // keep server props
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [poll.id, user?.id]);

  const handleVote = async (choice: PollChoice) => {
    if (!votingOpen || userVote || isSubmitting) return;
    if (!user) {
      setError('Du må logge inn for å stemme.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId: poll.id, choice }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Kunne ikke registrere stemme');
        return;
      }
      setUserVote(choice);
      if (data.totals) setTotals(data.totals);
    } catch {
      setError('En feil oppstod');
    } finally {
      setIsSubmitting(false);
    }
  };

  const jaPct = pollChoicePercent(totals, 'ja');
  const neiPct = pollChoicePercent(totals, 'nei');
  const blankPct = pollChoicePercent(totals, 'blank');
  const trackLabel = poll.track === 'stortinget' ? 'Stortingssporet' : 'Borgersporet';

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gradient-to-br from-[#00205b]/[0.04] via-white to-sky-50/40 px-5 py-4 sm:px-6">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500">
          <span className="rounded-md bg-[#00205b]/10 px-2 py-0.5 text-[#00205b]">{trackLabel}</span>
          <span>{votingOpen ? 'Åpen avstemning' : 'Stengt'}</span>
          {poll.stortingetIssueId ? (
            <Link href={routes.sak(poll.stortingetIssueId)} className="text-indigo-700 hover:underline">
              Se saksgrunnlag
            </Link>
          ) : null}
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">
          <Link href={routes.poll(poll.id)} className="hover:underline">
            {poll.title}
          </Link>
        </h2>
        {poll.neutralSummary ? (
          <p className={cn('mt-2 text-sm leading-relaxed text-gray-600', compact && 'line-clamp-3')}>
            {poll.neutralSummary}
          </p>
        ) : (
          <p className="mt-2 text-sm text-gray-500">Nøytral saksingress kommer snart.</p>
        )}
        {poll.sourceUrls.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-3 text-xs">
            {poll.sourceUrls.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-indigo-700 hover:underline"
                >
                  {source.label || 'Offisiell kilde'}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="space-y-4 px-5 py-4 sm:px-6">
        {!compact ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <ArgumentList title="Mest fremtredende Ja-argumenter" tone="ja" items={topArgs.ja} />
            <ArgumentList title="Mest fremtredende Nei-argumenter" tone="nei" items={topArgs.nei} />
          </div>
        ) : null}

        {poll.forumThreadId ? (
          <p className="text-sm text-gray-600">
            Debatter i{' '}
            <Link href={routes.forumTopic(poll.forumThreadId)} className="font-medium text-indigo-700 hover:underline">
              forumtråden
            </Link>{' '}
            — merk svar som Ja eller Nei for å bli vurdert som fremtredende argument.
          </p>
        ) : null}

        {userVote ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            <CheckCircle className="h-4 w-4 shrink-0" />
            Stemmen din er registrert anonymt
            {loaded ? ` (${userVote === 'ja' ? 'Ja' : userVote === 'nei' ? 'Nei' : 'Blank'})` : ''}.
          </motion.div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-3">
          <VoteButton
            label="Ja"
            icon={ThumbsUp}
            active={userVote === 'ja'}
            disabled={!votingOpen || Boolean(userVote) || isSubmitting}
            onClick={() => handleVote('ja')}
            tone="ja"
          />
          <VoteButton
            label="Nei"
            icon={ThumbsDown}
            active={userVote === 'nei'}
            disabled={!votingOpen || Boolean(userVote) || isSubmitting}
            onClick={() => handleVote('nei')}
            tone="nei"
          />
          <VoteButton
            label="Blank"
            icon={Minus}
            active={userVote === 'blank'}
            disabled={!votingOpen || Boolean(userVote) || isSubmitting}
            onClick={() => handleVote('blank')}
            tone="blank"
          />
        </div>

        {!user ? (
          <p className="flex items-center gap-2 text-sm text-gray-600">
            <LogIn className="h-4 w-4" />
            <Link href={routes.login} className="font-medium text-indigo-700 hover:underline">
              Logg inn
            </Link>{' '}
            for å stemme — én person, én stemme.
          </p>
        ) : null}

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}

        <div className="space-y-2 pt-1">
          <ResultBar label="Ja" percent={jaPct} count={totals.ja} className="bg-emerald-500" />
          <ResultBar label="Nei" percent={neiPct} count={totals.nei} className="bg-rose-500" />
          <ResultBar label="Blank" percent={blankPct} count={totals.blank} className="bg-slate-400" />
          <p className="text-xs text-gray-500">{totals.total} stemmer totalt</p>
        </div>

        <div className="flex flex-wrap gap-3 pt-1 text-sm">
          <Link href={routes.poll(poll.id)} className="font-medium text-[#00205b] hover:underline">
            Se fylkesfordeling
          </Link>
        </div>
      </div>
    </article>
  );
}

function VoteButton({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
  tone,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  tone: 'ja' | 'nei' | 'blank';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors',
        tone === 'ja' && 'border-emerald-200 hover:bg-emerald-50',
        tone === 'nei' && 'border-rose-200 hover:bg-rose-50',
        tone === 'blank' && 'border-slate-200 hover:bg-slate-50',
        active && tone === 'ja' && 'bg-emerald-600 text-white hover:bg-emerald-600',
        active && tone === 'nei' && 'bg-rose-600 text-white hover:bg-rose-600',
        active && tone === 'blank' && 'bg-slate-700 text-white hover:bg-slate-700',
        disabled && !active && 'cursor-not-allowed opacity-50',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function ResultBar({
  label,
  percent,
  count,
  className,
}: {
  label: string;
  percent: number;
  count: number;
  className: string;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span>
          {percent}% · {count}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <motion.div
          className={cn('h-full rounded-full', className)}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
