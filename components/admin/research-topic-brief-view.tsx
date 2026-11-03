'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import {
  RESEARCH_TOPIC_BRIEF_GRADE_LEGEND,
  RESEARCH_TOPIC_UNPUBLISHABLE_NOTICE,
  buildResearchTopicBriefViewModel,
  researchTopicRowDisplayTitle,
  sectionIsEmpty,
  type ResearchTopicBriefSource,
} from '@/lib/admin/research/topic-brief-schema';
import {
  formatResearchTopicBriefError,
  researchTopicBriefErrorAllowsRetry,
  researchTopicBriefErrorShowsDeveloperHint,
  researchTopicBriefFailedMessage,
  RESEARCH_TOPIC_BRIEF_DEVELOPER_HINT,
} from '@/lib/admin/research/topic-error-messages';
import type { ResearchTopicRow as TopicRowType } from '@/lib/admin/research/topic-types';
import { routes } from '@/lib/routes';

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

export function ResearchTopicBriefView({ topic }: { topic: TopicRowType }) {
  const heading = researchTopicRowDisplayTitle({
    status: topic.status,
    rawTitle: topic.title,
    output: topic.output,
    redditSubreddit: topic.subreddit,
  });

  if (topic.status === 'queued' || topic.status === 'running') {
    return (
      <div className="space-y-3" role="status">
        <div className="animate-pulse space-y-3 rounded-xl border border-border bg-card p-6">
          <div className="h-4 w-1/3 rounded bg-muted" />
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-5/6 rounded bg-muted" />
        </div>
        {topic.title ? (
          <p className="text-xs text-muted-foreground line-clamp-2">{topic.title}</p>
        ) : null}
        <RedditSourceAdminLink topic={topic} />
        <p className="text-sm text-muted-foreground">Tema-brief genereres. Oppdater siden om litt.</p>
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
            <p className="mt-3 text-sm text-muted-foreground">
              Gå tilbake til Research og velg «Prøv igjen» på raden.
            </p>
            {researchTopicBriefErrorShowsDeveloperHint(topic.error) ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {RESEARCH_TOPIC_BRIEF_DEVELOPER_HINT}
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
      <div>
        <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
        {model.rawAdminTitle && model.output.topic_title ? (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{model.rawAdminTitle}</p>
        ) : null}
        <RedditSourceAdminLink topic={topic} />
      </div>

      {model.showUnpublishableNotice ? (
        <div
          className="flex flex-wrap items-start gap-2 rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground"
          role="status"
        >
          <span className="inline-flex rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Ikke publiserbar
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            {model.blockingReason ? <p>{model.blockingReason}</p> : null}
            <p>{RESEARCH_TOPIC_UNPUBLISHABLE_NOTICE}</p>
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
            {output.generated_at}
          </time>
        </p>
      ) : null}
    </div>
  );
}
