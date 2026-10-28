'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Code2 } from 'lucide-react';
import { PollBallotVoteButton } from '@/components/polls/poll-ballot-vote-button';
import { ShareTrigger } from '@/components/share/share-trigger';
import { useAuth } from '@/hooks/use-auth';
import { Dialog } from '@/components/ui/dialog';
import { formatStemmerCount } from '@/lib/norwegian-plural';
import { pollChoicePercent } from '@/lib/polls/format';
import {
  POLL_BALLOT_RESULT_BAR_CLASS,
  POLL_BALLOT_VOTE_BUTTON_GRID_CLASS,
  pollBallotAltTextPhrase,
  pollBallotRunningTextPhrase,
} from '@/lib/polls/ballot-buttons';
import { pollChoiceLabel } from '@/lib/polls/labels';
import type { PollChoice, PollTotals } from '@/lib/polls/types';
import {
  DEFAULT_EMBED_RADIUS,
  serializePollEmbedOptions,
  type PollEmbedOptions,
  type PollEmbedSize,
  type PollEmbedTheme,
} from '@/lib/polls/embed';
import {
  buildPollEmbedSnippet,
  buildPollEmbedUrl,
  buildPollShareChannelUrl,
  buildPollShareRelativePath,
  buildPollShareText,
  isPollChoice,
  POLL_BALLOT_CHOICES,
} from '@/lib/polls/share';
import type { ShareChannel } from '@/lib/share/targets';
import { loginWithNext } from '@/lib/safe-redirect';
import { cn } from '@/lib/utils';

/** Below this many votes we show counts, not percentages. */
export const POLL_LOW_SAMPLE_THRESHOLD = 30;

const STORAGE_PREFIX = 'folkets:poll-choice:';

function readStoredChoice(pollId: string): PollChoice | null {
  try {
    const value = window.sessionStorage.getItem(`${STORAGE_PREFIX}${pollId}`);
    return isPollChoice(value) ? value : null;
  } catch {
    return null;
  }
}

function storeChoice(pollId: string, choice: PollChoice | null): void {
  try {
    const key = `${STORAGE_PREFIX}${pollId}`;
    if (choice) window.sessionStorage.setItem(key, choice);
    else window.sessionStorage.removeItem(key);
  } catch {
    // sessionStorage unavailable (private mode / partitioned iframe) — ignore.
  }
}

type SharePollWidgetProps = {
  pollId: string;
  title: string;
  votingOpen: boolean;
  initialTotals: PollTotals;
  initialVote: PollChoice | null;
  /** Absolute canonical URL of the public share page (no tracking params). */
  shareUrl: string;
  variant?: 'page' | 'embed';
  /** Preselected answer from `?valg=` — opens the confirm step, never auto-submits. */
  initialChoice?: PollChoice | null;
  /** Partner/campaign tag from `?ref=`. */
  refCode?: string | null;
  /** Embed size from `?size=` (defaults to `full`). */
  size?: PollEmbedSize;
  /** id of the page H1, used for `aria-labelledby` on the answer group. */
  headingId?: string;
  /** Mirrors the page's `og:description` in the share dialog preview. */
  shareDescription?: string;
};

export function SharePollWidget({
  pollId,
  title,
  votingOpen,
  initialTotals,
  initialVote,
  shareUrl,
  variant = 'page',
  initialChoice = null,
  refCode = null,
  size = 'full',
  headingId,
  shareDescription,
}: SharePollWidgetProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);

  const [totals, setTotals] = useState(initialTotals);
  const [userVote, setUserVote] = useState<PollChoice | null>(initialVote);
  const [pending, setPending] = useState<PollChoice | null>(
    initialVote ? null : initialChoice,
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const [configOpen, setConfigOpen] = useState(false);
  const [snippetTab, setSnippetTab] = useState<'auto' | 'plain'>('auto');
  const [embedOptions, setEmbedOptions] = useState<PollEmbedOptions>({
    theme: 'auto',
    size,
    radius: DEFAULT_EMBED_RADIUS,
    border: true,
    summary: size === 'full',
    ref: refCode ?? null,
  });

  const origin = useMemo(() => {
    try {
      return new URL(shareUrl).origin;
    } catch {
      return undefined;
    }
  }, [shareUrl]);

  const shareText = useMemo(() => buildPollShareText(title), [title]);
  const shareChannelUrl = useCallback(
    (channel: ShareChannel) => buildPollShareChannelUrl(pollId, origin, channel, refCode),
    [origin, pollId, refCode],
  );

  const embedSrc = useMemo(
    () => buildPollEmbedUrl(pollId, origin, embedOptions),
    [origin, pollId, embedOptions],
  );
  const embedSnippet = useMemo(
    () =>
      buildPollEmbedSnippet({
        pollId,
        origin,
        title: `Folkets Meninger: ${title}`,
        options: embedOptions,
        autoHeight: snippetTab === 'auto',
      }),
    [pollId, origin, title, embedOptions, snippetTab],
  );

  // Restore a choice stashed before the login round-trip (page variant only).
  useEffect(() => {
    if (variant !== 'page' || initialVote || initialChoice) return;
    const stored = readStoredChoice(pollId);
    if (stored) setPending(stored);
  }, [variant, pollId, initialVote, initialChoice]);

  // Auto-height for the iframe host via postMessage.
  useEffect(() => {
    if (variant !== 'embed' || typeof window === 'undefined') return;
    if (window.parent === window) return;
    const node = rootRef.current;
    if (!node) return;

    const post = (payload: Record<string, unknown>) =>
      window.parent.postMessage({ version: 1, pollId, ...payload }, '*');
    post({ type: 'fm:ready' });

    let lastHeight = -1;
    const sendHeight = () => {
      const height = Math.ceil(node.scrollHeight);
      if (height === lastHeight) return;
      lastHeight = height;
      post({ type: 'fm:resize', height });
    };
    sendHeight();
    const observer = new ResizeObserver(sendHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [variant, pollId, totals, userVote, pending]);

  const submitVote = useCallback(
    async (choice: PollChoice) => {
      setBusy(true);
      setError('');
      try {
        const res = await fetch('/api/polls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pollId, choice }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : 'Kunne ikke registrere stemme');
          return;
        }
        if (data.totals) setTotals(data.totals as PollTotals);
        setUserVote(choice);
        setPending(null);
        storeChoice(pollId, null);
        if (variant === 'embed') {
          window.parent.postMessage({ version: 1, type: 'fm:voted', pollId }, '*');
        }
      } catch {
        setError('En feil oppstod');
      } finally {
        setBusy(false);
      }
    },
    [pollId, variant],
  );

  const handleChoice = (choice: PollChoice) => {
    if (!votingOpen || userVote || busy || loading) return;
    setError('');

    if (variant === 'embed') {
      // Voting requires login; open the public share page in a new tab with the
      // choice preserved. Resolve against `shareUrl` so the link targets the app
      // origin rather than the partner site hosting the iframe.
      const target = new URL(
        buildPollShareRelativePath(pollId, { choice, ref: refCode }),
        shareUrl,
      ).toString();
      window.open(target, '_blank', 'noopener,noreferrer');
      return;
    }

    storeChoice(pollId, choice);
    setPending(choice);

    if (!user) {
      const next = buildPollShareRelativePath(pollId, { choice, ref: refCode });
      router.push(loginWithNext(next));
    }
  };

  const copyToClipboard = useCallback(
    async (value: string, confirmation: string) => {
      setError('');
      try {
        await navigator.clipboard.writeText(value);
        setCopied(confirmation);
        window.setTimeout(() => setCopied(''), 2500);
      } catch {
        setError('Kunne ikke kopiere automatisk. Kopier lenken manuelt.');
      }
    },
    [],
  );

  const showResults = Boolean(userVote) || !votingOpen;
  const lowSample = totals.total < POLL_LOW_SAMPLE_THRESHOLD;
  const embed = variant === 'embed';
  const compact = embed && size === 'compact';

  return (
    <section ref={rootRef} className={cn('space-y-5', compact && 'space-y-3')} lang="nb">
      <div
        role="group"
        aria-labelledby={headingId}
        aria-label={headingId ? undefined : `Stem ${pollBallotAltTextPhrase()}`}
        className={cn(POLL_BALLOT_VOTE_BUTTON_GRID_CLASS, !compact && 'gap-3')}
      >
        {POLL_BALLOT_CHOICES.map((choice) => {
          const selectedVote = userVote === choice;
          const isPending = pending === choice && !userVote;
          const dimmed = (!votingOpen || Boolean(userVote)) && !selectedVote;
          const selected = selectedVote || isPending;
          return (
            <PollBallotVoteButton
              key={choice}
              choice={choice}
              selected={selected}
              disabled={!votingOpen || Boolean(userVote) || busy || loading}
              onClick={() => handleChoice(choice)}
              className={cn(dimmed ? 'opacity-60' : '', busy ? 'cursor-wait opacity-70' : '')}
            >
              {pollChoiceLabel(choice)}
            </PollBallotVoteButton>
          );
        })}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {!votingOpen ? (
        <p className="text-sm text-muted-foreground">Avstemningen er stengt. Her er resultatet.</p>
      ) : userVote ? (
        <p className="text-sm text-foreground">
          Takk! Stemmen din er registrert. Ingen andre kan se hva du stemte.
        </p>
      ) : user && !loading ? (
        <div className="space-y-3 rounded-2xl border border-border bg-muted/40 p-4">
          <p className="text-sm text-foreground">
            {pending ? (
              <>
                Du har valgt <strong>{pollChoiceLabel(pending)}</strong>. Bekreft for å
                registrere stemmen. Du kan endre valget ved å trykke på et annet alternativ.
              </>
            ) : (
              <>Velg ett av alternativene over, og bekreft stemmen din.</>
            )}
          </p>
          <button
            type="button"
            disabled={busy || !pending}
            onClick={() => {
              if (pending) void submitVote(pending);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#00205b] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#00205b]/90 disabled:opacity-60 dark:bg-[#8fb4ff] dark:text-[#0b1220]"
          >
            {busy ? 'Sender…' : 'Bekreft stemmen'}
          </button>
        </div>
      ) : pending && !user && !loading ? (
        <p className="text-sm text-muted-foreground">
          Du valgte <strong className="text-foreground">{pollChoiceLabel(pending)}</strong>.{' '}
          <button
            type="button"
            onClick={() => {
              const next = buildPollShareRelativePath(pollId, { choice: pending, ref: refCode });
              router.push(loginWithNext(next));
            }}
            className="font-semibold text-brand hover:underline"
          >
            Logg inn
          </button>{' '}
          for å registrere stemmen. Det tar under ett minutt.
        </p>
      ) : !loading && !user ? (
        <p className="text-sm text-muted-foreground">
          Velg svar, så logger du inn for at stemmen skal telle. Det tar under ett minutt.
        </p>
      ) : null}

      {showResults ? (
        <div
          className="space-y-3 rounded-2xl border border-border bg-card p-4"
          aria-live="polite"
        >
          <h2 className="text-sm font-semibold text-foreground">Resultat</h2>
          {POLL_BALLOT_CHOICES.map((choice) => {
            const pct = pollChoicePercent(totals, choice);
            return (
              <div key={choice}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-semibold text-foreground">
                    <span
                      className={cn('h-2.5 w-2.5 rounded-full', POLL_BALLOT_RESULT_BAR_CLASS[choice])}
                      aria-hidden
                    />
                    {pollChoiceLabel(choice)}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {lowSample || pct == null ? totals[choice] : `${pct}% · ${totals[choice]}`}
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500',
                      POLL_BALLOT_RESULT_BAR_CLASS[choice],
                    )}
                    style={{ width: lowSample || pct == null ? '0%' : `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            {lowSample
              ? `${formatStemmerCount(totals.total)} · For få stemmer til å vise prosent ennå`
              : `${formatStemmerCount(totals.total)} · Uoffisiell meningsmåling, ikke representativ`}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {!compact ? (
          <ShareTrigger
            label="Del spørsmålet"
            dialogTitle="Del spørsmålet"
            open={shareOpen}
            onOpenChange={setShareOpen}
            url={shareUrl}
            title={title}
            text={shareText}
            description={
              shareDescription ??
              `Stem ${pollBallotRunningTextPhrase()}. Se hva andre mener på Folkets Meninger.`
            }
            previewImageUrl={`${shareUrl.replace(/[?#].*$/, '')}/opengraph-image`}
            channelUrl={shareChannelUrl}
            showPreview={!embed}
            extraActions={
              !embed ? (
                <button
                  type="button"
                  onClick={() => {
                    setShareOpen(false);
                    setConfigOpen(true);
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl px-1 text-sm font-medium text-brand hover:underline"
                >
                  <Code2 className="h-4 w-4" aria-hidden />
                  Bygg inn på nettstedet ditt
                </button>
              ) : undefined
            }
          />
        ) : (
          <a
            href={buildPollShareRelativePath(pollId, { ref: 'embed' })}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm font-semibold text-brand hover:underline"
          >
            Se resultat
          </a>
        )}
        <span className="text-xs text-muted-foreground" role="status" aria-live="polite">
          {copied}
        </span>
      </div>

      {!embed ? (
        <EmbedConfigurator
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          pollId={pollId}
          title={title}
          optionState={[embedOptions, setEmbedOptions]}
          tab={snippetTab}
          onTabChange={setSnippetTab}
          embedSrc={embedSrc}
          snippet={embedSnippet}
          onCopy={(value) => void copyToClipboard(value, 'Innbyggingskode kopiert')}
        />
      ) : null}
    </section>
  );
}

type EmbedConfiguratorProps = {
  open: boolean;
  onClose: () => void;
  pollId: string;
  title: string;
  optionState: [PollEmbedOptions, (next: PollEmbedOptions) => void];
  tab: 'auto' | 'plain';
  onTabChange: (tab: 'auto' | 'plain') => void;
  embedSrc: string;
  snippet: string;
  onCopy: (value: string) => void;
};

const THEME_OPTIONS: { value: PollEmbedTheme; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Lys' },
  { value: 'dark', label: 'Mørk' },
];

const SIZE_OPTIONS: { value: PollEmbedSize; label: string }[] = [
  { value: 'full', label: 'Full' },
  { value: 'compact', label: 'Kompakt' },
];

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              value === option.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmbedConfigurator({
  open,
  onClose,
  title,
  optionState,
  tab,
  onTabChange,
  embedSrc,
  snippet,
  onCopy,
}: EmbedConfiguratorProps) {
  const [options, setOptions] = optionState;
  const previewKey = serializePollEmbedOptions(options);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Bygg inn på nettstedet ditt"
      description="Velg utseende og kopier koden. Merke, kilde og forbehold kan ikke skjules."
      size="xl"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <SegmentedControl
            label="Tema"
            value={options.theme}
            options={THEME_OPTIONS}
            onChange={(theme) => setOptions({ ...options, theme })}
          />
          <SegmentedControl
            label="Størrelse"
            value={options.size}
            options={SIZE_OPTIONS}
            onChange={(size) =>
              setOptions({ ...options, size, summary: size === 'full' && options.summary })
            }
          />
          <div className="space-y-1.5">
            <label
              htmlFor="embed-radius"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Hjørner: {options.radius}px
            </label>
            <input
              id="embed-radius"
              type="range"
              min={0}
              max={24}
              value={options.radius}
              onChange={(event) =>
                setOptions({ ...options, radius: Number(event.target.value) })
              }
              className="w-full accent-[#00205b]"
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={options.border}
              onChange={(event) => setOptions({ ...options, border: event.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            Vis kant
          </label>

          <div className="space-y-2">
            <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => onTabChange('auto')}
                className={cn(
                  'flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  tab === 'auto'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Med auto-høyde (anbefalt)
              </button>
              <button
                type="button"
                onClick={() => onTabChange('plain')}
                className={cn(
                  'flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  tab === 'plain'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Bare iframe
              </button>
            </div>
            <pre className="max-h-40 overflow-auto rounded-xl border border-border bg-muted/40 p-3 text-xs leading-relaxed text-foreground">
              <code className="whitespace-pre-wrap break-all">{snippet}</code>
            </pre>
            <button
              type="button"
              onClick={() => onCopy(snippet)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#00205b] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#00205b]/90 dark:bg-[#8fb4ff] dark:text-[#0b1220]"
            >
              <Code2 className="h-4 w-4" aria-hidden />
              Kopier kode
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Forhåndsvisning
          </span>
          <div className="overflow-hidden rounded-xl border border-border bg-background p-3">
            <iframe
              key={previewKey}
              src={embedSrc}
              title={`Forhåndsvisning: ${title}`}
              width="100%"
              height={options.size === 'compact' ? 220 : 440}
              loading="lazy"
              className="w-full"
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
}
