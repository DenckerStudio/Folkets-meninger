'use client';

import Link from 'next/link';
import { ExternalLink, Gavel, Globe, Layers, ListFilter, PenLine, ScrollText } from 'lucide-react';
import { routes } from '@/lib/routes';

/**
 * Tool results streamed by `/api/chat`. Kept structural (no class imports) so the
 * server tools in `lib/chat/tools.ts` stay the single source of truth for shapes.
 */
type SakContextOutput = {
  issue?: { id?: string; title?: string | null; henvisning?: string | null } | null;
  summary?: string | null;
  chunks?: Array<{ documentId?: string; chunkIndex?: number; content?: string }>;
  note?: string | null;
};

type SourceSearchOutput = {
  unavailable?: boolean;
  error?: string;
  results?: Array<{ title?: string | null; url?: string | null; content?: string | null }>;
};

type MatchingIssuesOutput = {
  issues?: Array<{
    id?: string;
    title?: string | null;
    henvisning?: string | null;
    ferdigbehandlet?: boolean | null;
  }>;
  note?: string | null;
};

type RettskrivingOutput = {
  original?: string;
  corrected?: string | null;
  notes?: string | null;
  instruction?: string;
  published?: false;
};

type TopicContextOutput = {
  query?: string;
  saker?: Array<{
    issue?: { id?: string; title?: string | null; henvisning?: string | null } | null;
    summary?: string | null;
    chunks?: Array<{ documentId?: string; chunkIndex?: number; content?: string }>;
  }>;
  note?: string | null;
};

type VoteResultsOutput = {
  found?: boolean;
  issueId?: string;
  note?: string | null;
  hasStortingetVote?: boolean;
  stortinget?: {
    for?: number;
    against?: number;
    absent?: number;
    decided?: number;
    adopted?: boolean;
  } | null;
  stortingetForPercent?: number | null;
  stortingetAgainstPercent?: number | null;
  folk?: { for?: number; against?: number; abstain?: number; total?: number };
  folkForPercent?: number;
  folkAgainstPercent?: number;
  score?: number | null;
  gapPoints?: number | null;
  headline?: string;
  summary?: string;
  voteringTema?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function SakContextCard({ output }: { output: SakContextOutput }) {
  const issue = output.issue ?? null;
  const chunks = output.chunks ?? [];

  if (!issue?.id) {
    return (
      <ToolCard icon={ScrollText} title="Fant ingen sak" tone="muted">
        {output.note || 'Ingen matching sak i vår cache. Prøv sak-id eller en mer konkret tittel.'}
      </ToolCard>
    );
  }

  return (
    <ToolCard
      icon={ScrollText}
      title={issue.title || `Sak ${issue.id}`}
      tone="brand"
      action={
        <Link
          href={routes.sak(issue.id)}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
        >
          Åpne sak
          <ExternalLink className="size-3" aria-hidden />
        </Link>
      }
    >
      <p className="text-xs text-muted-foreground">
        Sak {issue.id}
        {issue.henvisning ? ` · ${issue.henvisning}` : ''}
      </p>
      {output.summary ? (
        <p className="whitespace-pre-wrap text-sm text-foreground">{output.summary}</p>
      ) : null}
      {chunks.length > 0 ? (
        <ul className="space-y-1.5">
          {chunks.slice(0, 4).map((chunk, index) => (
            <li
              key={`${chunk.documentId ?? 'doc'}-${chunk.chunkIndex ?? index}`}
              className="rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-xs text-foreground"
            >
              <span className="font-medium text-muted-foreground">
                Dokumentutdrag {(chunk.chunkIndex ?? index) + 1}
              </span>
              {chunk.content ? (
                <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap text-foreground">
                  {chunk.content}
                </p>
              ) : null}
            </li>
          ))}
          {chunks.length > 4 ? (
            <li className="text-xs text-muted-foreground">
              + {chunks.length - 4} til i dokumentene.
            </li>
          ) : null}
        </ul>
      ) : output.note ? (
        <p className="text-xs text-muted-foreground">{output.note}</p>
      ) : null}
    </ToolCard>
  );
}

function SourceSearchCard({ output }: { output: SourceSearchOutput }) {
  const results = output.results ?? [];
  if (output.unavailable) {
    return (
      <ToolCard icon={Globe} title="Kildesøk utilgjengelig" tone="muted">
        {output.error || 'SearXNG er ikke tilgjengelig akkurat nå.'}
      </ToolCard>
    );
  }
  if (results.length === 0) {
    return (
      <ToolCard icon={Globe} title="Ingen oppdaterte kilder" tone="muted">
        {output.error || 'Søket ga ingen treff.'}
      </ToolCard>
    );
  }
  return (
    <ToolCard icon={Globe} title={`${results.length} kilder`} tone="brand">
      <ul className="space-y-1.5">
        {results.slice(0, 6).map((result, index) => (
          <li key={`${result.url ?? 'src'}-${index}`} className="text-xs">
            {result.url ? (
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-start gap-1 font-medium text-brand hover:underline"
              >
                {result.title || result.url}
                <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden />
              </a>
            ) : (
              <span className="font-medium text-foreground">{result.title || 'Kilde'}</span>
            )}
            {result.content ? (
              <p className="mt-0.5 line-clamp-2 text-muted-foreground">{result.content}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </ToolCard>
  );
}

function MatchingIssuesCard({ output }: { output: MatchingIssuesOutput }) {
  const issues = output.issues ?? [];
  if (issues.length === 0) {
    return (
      <ToolCard icon={ListFilter} title="Ingen saker funnet" tone="muted">
        {output.note || 'Ingen treff i sakcachen. Prøv et mer presist søk eller kildesøk.'}
      </ToolCard>
    );
  }
  return (
    <ToolCard icon={ListFilter} title={`${issues.length} saker`} tone="brand">
      <ul className="space-y-1">
        {issues.map((issue) =>
          issue?.id ? (
            <li key={issue.id}>
              <Link
                href={routes.sak(issue.id)}
                className="text-xs font-medium text-foreground hover:text-brand hover:underline"
              >
                {issue.title || `Sak ${issue.id}`}
              </Link>
              <span className="text-xs text-muted-foreground">
                {issue.henvisning ? ` · ${issue.henvisning}` : ''}
                {issue.ferdigbehandlet ? ' · behandlet' : ''}
              </span>
            </li>
          ) : null,
        )}
      </ul>
    </ToolCard>
  );
}

function TopicContextCard({ output }: { output: TopicContextOutput }) {
  const saker = (output.saker ?? []).filter((sak) => sak?.issue?.id);

  if (saker.length === 0) {
    return (
      <ToolCard icon={Layers} title="Fant ingen saker" tone="muted">
        {output.note || 'Ingen matching saker i vår cache. Prøv et mer konkret spørsmål.'}
      </ToolCard>
    );
  }

  return (
    <ToolCard
      icon={Layers}
      title={saker.length === 1 ? '1 sak' : `${saker.length} saker`}
      tone="brand"
    >
      <ul className="space-y-2">
        {saker.map((sak) => {
          const issue = sak.issue!;
          const id = issue.id!;
          const chunkCount = (sak.chunks ?? []).length;
          return (
            <li key={id} className="space-y-0.5">
              <Link
                href={routes.sak(id)}
                className="text-xs font-medium text-foreground hover:text-brand hover:underline"
              >
                {issue.title || `Sak ${id}`}
              </Link>
              <p className="text-xs text-muted-foreground">
                {issue.henvisning ? `${issue.henvisning} · ` : ''}
                {chunkCount > 0 ? `${chunkCount} dokumentutdrag` : 'kun sammendrag'}
              </p>
            </li>
          );
        })}
      </ul>
      {output.note ? <p className="text-xs text-muted-foreground">{output.note}</p> : null}
    </ToolCard>
  );
}

function RettskrivingCard({ output }: { output: RettskrivingOutput }) {
  return (
    <ToolCard icon={PenLine} title="Rettet forslag" tone="brand">
      {output.corrected ? (
        <p className="whitespace-pre-wrap rounded-lg border border-border bg-background/60 px-2.5 py-2 text-sm text-foreground">
          {output.corrected}
        </p>
      ) : (
        <p className="text-sm text-foreground">
          {output.instruction || 'Brukerens kladd er klar til gjennomgang.'}
        </p>
      )}
      {output.notes ? <p className="text-xs text-muted-foreground">{output.notes}</p> : null}
      <p className="text-xs text-muted-foreground">
        Hjelp til din egen tekst — ikke publisert innhold.
      </p>
    </ToolCard>
  );
}

function VoteResultsCard({ output }: { output: VoteResultsOutput }) {
  if (output.found === false || !output.issueId) {
    return (
      <ToolCard icon={Gavel} title="Fant ingen stemmer" tone="muted">
        {output.note || 'Fant ingen sak å hente stemmeresultat for.'}
      </ToolCard>
    );
  }

  const stortinget = output.stortinget ?? null;
  const folk = output.folk ?? {};
  const folkTotal = folk.total ?? 0;

  return (
    <ToolCard
      icon={Gavel}
      title="Folkets vilje vs. Stortinget"
      tone="brand"
      action={
        <Link
          href={routes.sak(output.issueId)}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
        >
          Åpne sak
          <ExternalLink className="size-3" aria-hidden />
        </Link>
      }
    >
      {output.headline ? (
        <p className="text-sm font-medium text-foreground">{output.headline}</p>
      ) : null}
      {output.summary ? <p className="text-xs text-muted-foreground">{output.summary}</p> : null}

      {stortinget && output.stortingetForPercent != null ? (
        <p className="text-xs text-foreground">
          <span className="font-medium text-muted-foreground">Stortinget: </span>
          {stortinget.adopted ? 'vedtok' : 'nedstemte'} · For {output.stortingetForPercent}% · Mot{' '}
          {output.stortingetAgainstPercent ?? 0}%
          {stortinget.absent ? ` · ${stortinget.absent} ikke til stede` : ''}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {stortinget
            ? 'Stortinget behandlet saken uten elektronisk personlig votering.'
            : 'Ingen votering er registrert hos Stortinget for denne saken ennå.'}
        </p>
      )}

      {folkTotal > 0 ? (
        <p className="text-xs text-foreground">
          <span className="font-medium text-muted-foreground">Folket i appen ({folkTotal}): </span>
          For {output.folkForPercent ?? 0}% · Mot {output.folkAgainstPercent ?? 0}%
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Ingen anonyme stemmer i appen ennå.</p>
      )}

      {output.score != null ? (
        <p className="text-xs text-muted-foreground">
          Samsvars-score {output.score}
          {output.gapPoints != null ? ` · avstand ${output.gapPoints} prosentpoeng` : ''}
        </p>
      ) : null}

      {output.voteringTema ? (
        <p className="text-xs text-muted-foreground">Voteringstema: {output.voteringTema}</p>
      ) : null}
    </ToolCard>
  );
}

function ToolCard({
  icon: Icon,
  title,
  tone,
  action,
  children,
}: {
  icon: typeof ScrollText;
  title: string;
  tone: 'brand' | 'muted';
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      data-chat-tool-card=""
      className={`space-y-2 rounded-xl border px-3 py-2.5 text-sm ${
        tone === 'brand' ? 'border-brand/25 bg-brand/5' : 'border-border bg-muted/40'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={`flex items-center gap-1.5 text-xs font-semibold ${
            tone === 'brand' ? 'text-brand' : 'text-muted-foreground'
          }`}
        >
          <Icon className="size-3.5 shrink-0" aria-hidden />
          {title}
        </p>
        {action}
      </div>
      <div className="space-y-1.5 text-foreground">{children}</div>
    </div>
  );
}

/** Renders a streamed tool `output` as a card, falling back to a plain note. */
export function ChatToolResult({
  toolType,
  output,
}: {
  toolType: string;
  output: unknown;
}) {
  if (!isRecord(output)) return null;

  switch (toolType) {
    case 'tool-retrieveSakContext':
      return <SakContextCard output={output as SakContextOutput} />;
    case 'tool-retrieveTopicContext':
      return <TopicContextCard output={output as TopicContextOutput} />;
    case 'tool-getVoteResults':
      return <VoteResultsCard output={output as VoteResultsOutput} />;
    case 'tool-searchUpdatedSources':
      return <SourceSearchCard output={output as SourceSearchOutput} />;
    case 'tool-listMatchingSaker':
      return <MatchingIssuesCard output={output as MatchingIssuesOutput} />;
    case 'tool-helpRettsskriving':
      return <RettskrivingCard output={output as RettskrivingOutput} />;
    default:
      return null;
  }
}