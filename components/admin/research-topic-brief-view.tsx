'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2 } from 'lucide-react';
import {
  RESEARCH_TOPIC_BRIEF_GRADE_LEGEND,
  RESEARCH_TOPIC_UNPUBLISHABLE_NOTICE,
  buildResearchTopicBriefViewModel,
  formatResearchTopicBriefGeneratedAt,
  sectionIsEmpty,
  type ResearchTopicBriefSource,
  type ResearchTopicStatus,
} from '@/lib/admin/research/topic-brief-schema';
import {
  formatResearchTopicBriefError,
  researchTopicBriefErrorAllowsRetry,
  researchTopicBriefErrorShowsDeveloperHint,
  researchTopicBriefFailedMessage,
  RESEARCH_TOPIC_BRIEF_DEVELOPER_HINT,
} from '@/lib/admin/research/topic-error-messages';
import { RESEARCH_BRIEF_POLL_MS } from '@/lib/admin/research/polling';
import type { ResearchTopicRow as TopicRowType } from '@/lib/admin/research/topic-types';
import { buttonVariants } from '@/components/ui/button';
import { ResearchTopicBlogDraftPanel } from '@/components/admin/research-topic-blog-draft-panel';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

function GradeBadge({ grade }: { grade: ResearchTopicBriefSource['grade'] }) {
  return (
    <span
      title={`Kildekvalitet ${grade}. ${RESEARCH_TOPIC_BRIEF_GRADE_LEGEND}`}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-muted/60 text-xs font-semibold tabular-nums text-foreground"
    >
      {grade}
    </span>
  );
}

function SectionBlock({
  heading,
  empty,
  children,
}: {
  heading: string;
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-foreground">{heading}</h2>
      {empty ? (
        <p className="text-sm text-muted-foreground">Ingen funnet</p>
      ) : (
        children
      )}
    </section>
  );
}

function SourceList({ sources }: { sources: ResearchTopicBriefSource[] }) {
  if (sources.length === 0) {
    return <p className="text-sm text-muted-foreground">Ingen funnet</p>;
  }
  return (
    <ul className="space-y-2">
      {sources.map((source) => (
        <li
          key={source.id}
          className="flex flex-wrap items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm"
        >
          <GradeBadge grade={source.grade} />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-medium text-foreground">{source.title}</p>
            <p className="text-xs text-muted-foreground">{source.publisher ?? 'Ukjent utgiver'}</p>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-brand hover:underline"
            >
              <span className="truncate">{source.url}</span>
              <ExternalLink className="size-3 shrink-0" aria-hidden />
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RedditSourceAdminLink({ topic }: { topic: TopicRowType }) {
  if (topic.source_kind !== 'reddit' || !topic.reddit_signal_id) return null;
  return (
    <p className="text-sm text-muted-foreground">
      Interessesignal:{' '}
      <Link href={routes.adminResearch} className="text-brand hover:underline">
        Vis rad i Research
      </Link>
      {topic.subreddit ? (
        <span className="text-muted-foreground">{` (r/${topic.subreddit})`}</span>
      ) : null}
    </p>
  );
}

function mergeTopicFromPoll(
  prev: TopicRowType,
  body: Record<string, unknown>,
): TopicRowType {
  const status = body.status as ResearchTopicStatus;
  return {
    ...prev,
    status,
    request_id: typeof body.request_id === 'string' ? body.request_id : prev.request_id,
    publishable: typeof body.publishable === 'boolean' ? body.publishable : null,
    blocking_reason:
      typeof body.blocking_reason === 'string' ? body.blocking_reason : prev.blocking_reason,
    error: typeof body.error === 'string' ? body.error : null,
    updated_at: typeof body.updated_at === 'string' ? body.updated_at : prev.updated_at,
    title: typeof body.title === 'string' ? body.title : prev.title,
    output: status === 'done' && body.output != null ? body.output : prev.output,
    subreddit: typeof body.subreddit === 'string' ? body.subreddit : prev.subreddit,
  };
}

export function ResearchTopicBriefView({ topic: initialTopic }: { topic: TopicRowType }) {
  const [topic, setTopic] = useState(initialTopic);
  const [retryPending, setRetryPending] = useState(false);
  const [retryError, setRetryError] = useState('');

  useEffect(() => {
    setTopic(initialTopic);
  }, [initialTopic]);

  const pollTopic = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/research/topics?topic_id=${encodeURIComponent(topic.id)}`,
      );
      if (!res.ok) return;
      const body = (await res.json()) as Record<string, unknown>;
      if (typeof body.status !== 'string') return;
      setTopic((prev) => mergeTopicFromPoll(prev, body));
    } catch {
      /* ignore poll errors */
    }
  }, [topic.id]);

  useEffect(() => {
    if (topic.status !== 'queued' && topic.status !== 'running') return;
    void pollTopic();
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void pollTopic();
    }, RESEARCH_BRIEF_POLL_MS);
    return () => window.clearInterval(id);
  }, [pollTopic, topic.status]);

  const retryBrief = useCallback(async () => {
    setRetryError('');
    setRetryPending(true);
    try {
      const res = await fetch('/api/admin/research/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_kind: topic.source_kind,
          cluster_id: topic.source_kind === 'cluster' ? topic.cluster_id : undefined,
          reddit_signal_id: topic.source_kind === 'reddit' ? topic.reddit_signal_id : undefined,
          title: topic.source_kind === 'cluster' ? topic.title : undefined,
          request_id: crypto.randomUUID(),
          force: true,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setRetryError(
          typeof body.message === 'string' && body.message.trim()
            ? body.message
            : 'Kunne ikke starte tema-brief på nytt',
        );
        return;
      }
      if (typeof body.topic_id === 'string' && typeof body.status === 'string') {
        setTopic((prev) => ({
          ...prev,
          id: body.topic_id as string,
          status: body.status as ResearchTopicStatus,
          request_id: typeof body.request_id === 'string' ? body.request_id : prev.request_id,
          error: null,
          publishable: typeof body.publishable === 'boolean' ? body.publishable : null,
          updated_at: new Date().toISOString(),
        }));
      }
    } catch {
      setRetryError('Kunne ikke starte tema-brief på nytt');
    } finally {
      setRetryPending(false);
    }
  }, [topic]);

  if (topic.status === 'queued' || topic.status === 'running') {
    return (
      <div className="space-y-3" role="status">
        <div className="animate-pulse space-y-3 rounded-xl border border-border bg-card p-6">
          <div className="h-4 w-1/3 rounded bg-muted" />
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-5/6 rounded bg-muted" />
        </div>
        <RedditSourceAdminLink topic={topic} />
        <p className="text-sm text-muted-foreground">Tema-brief genereres…</p>
      </div>
    );
  }

  if (topic.status === 'failed') {
    const allowsRetry = researchTopicBriefErrorAllowsRetry(topic.error);
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4" role="alert">
        <p className="text-sm font-medium text-destructive">Tema-brief feilet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {allowsRetry
            ? researchTopicBriefFailedMessage(topic.error)
            : formatResearchTopicBriefError(topic.error)}
        </p>
        {allowsRetry ? (
          <>
            {researchTopicBriefErrorShowsDeveloperHint(topic.error) ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {RESEARCH_TOPIC_BRIEF_DEVELOPER_HINT}
              </p>
            ) : null}
            <button
              type="button"
              disabled={retryPending}
              onClick={() => void retryBrief()}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'mt-4 min-h-11 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10',
              )}
            >
              {retryPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Prøv igjen
            </button>
            {retryError ? (
              <p className="mt-2 text-xs text-destructive" role="alert">
                {retryError}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-sm">
            <Link
              href={routes.adminResearch}
              className="font-medium text-brand underline-offset-4 hover:underline"
            >
              Tilbake til Research
            </Link>
          </p>
        )}
      </div>
    );
  }

  const model = buildResearchTopicBriefViewModel({
    output: topic.output,
    publishable: topic.publishable,
    blockingReason: topic.blocking_reason,
    rawTitle: topic.title,
    status: topic.status,
    redditSubreddit: topic.subreddit,
  });

  if (!model) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Ingen funn ennå</p>
      </div>
    );
  }

  const { output } = model;

  return (
    <div className="space-y-8">
      <RedditSourceAdminLink topic={topic} />

      <ResearchTopicBlogDraftPanel topic={topic} />

      {model.showUnpublishableNotice ? (
        <div
          className="flex flex-wrap items-start gap-2 rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground"
          role="status"
        >
          <span className="inline-flex rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Ikke publiserbar
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p>{model.blockingReason?.trim() || RESEARCH_TOPIC_UNPUBLISHABLE_NOTICE}</p>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">{RESEARCH_TOPIC_BRIEF_GRADE_LEGEND}</p>

      <SectionBlock heading="Dagens regler" empty={sectionIsEmpty(output.current_rules)}>
        {!sectionIsEmpty(output.current_rules) ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
            {output.current_rules.items.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {typeof item === 'string' ? item : JSON.stringify(item)}
              </li>
            ))}
          </ul>
        ) : null}
      </SectionBlock>

      <SectionBlock
        heading="Partienes forslag"
        empty={sectionIsEmpty(output.party_proposals)}
      >
        {!sectionIsEmpty(output.party_proposals) ? (
          <ul className="space-y-3">
            {output.party_proposals.items.map((item, idx) => (
              <li key={idx} className="text-sm">
                {typeof item === 'object' && item !== null ? (
                  <>
                    <p className="font-medium text-foreground">
                      {'party' in item ? String((item as { party?: string }).party) : 'Parti'}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {'proposal' in item
                        ? String((item as { proposal?: string }).proposal)
                        : ''}
                    </p>
                  </>
                ) : (
                  String(item)
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </SectionBlock>

      <SectionBlock heading="Mediedekning" empty={sectionIsEmpty(output.media_coverage)}>
        {!sectionIsEmpty(output.media_coverage) ? (
          <ul className="space-y-3">
            {output.media_coverage.items.map((item, idx) => (
              <li key={idx} className="text-sm">
                {typeof item === 'object' && item !== null && 'headline' in item ? (
                  <>
                    <p className="font-medium text-foreground">
                      {String((item as { headline?: string }).headline)}
                    </p>
                    {'summary' in item && (item as { summary?: string }).summary ? (
                      <p className="mt-1 text-muted-foreground">
                        {String((item as { summary?: string }).summary)}
                      </p>
                    ) : null}
                  </>
                ) : (
                  String(item)
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </SectionBlock>

      <SectionBlock heading="Meningsmålinger" empty={sectionIsEmpty(output.polls)}>
        {!sectionIsEmpty(output.polls) ? (
          <ul className="space-y-3">
            {output.polls.items.map((item, idx) => (
              <li key={idx} className="text-sm">
                {typeof item === 'object' && item !== null ? (
                  <>
                    <p className="font-medium text-foreground">
                      {'question' in item ? String((item as { question?: string }).question) : ''}
                    </p>
                    <p className="mt-1 tabular-nums text-muted-foreground">
                      {'result' in item ? String((item as { result?: string }).result) : ''}
                    </p>
                  </>
                ) : (
                  String(item)
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </SectionBlock>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Kilder</h2>
        <SourceList sources={model.filteredSources} />
      </section>

      {output.generated_at ? (
        <p className="text-xs text-muted-foreground">
          Generert{' '}
          <time dateTime={output.generated_at} className="tabular-nums">
            {formatResearchTopicBriefGeneratedAt(output.generated_at)}
          </time>
        </p>
      ) : null}
    </div>
  );
}
