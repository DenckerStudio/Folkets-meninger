'use client';

import Link from 'next/link';
import {
  Award,
  CalendarClock,
  Calculator,
  Clock,
  ExternalLink,
  FileText,
  Gavel,
  Globe,
  Layers,
  ListFilter,
  MessageSquare,
  PenLine,
  ScrollText,
  UserRound,
  Users,
  Vote,
} from 'lucide-react';
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

type HearingItem = {
  id?: string;
  title?: string | null;
  subtitle?: string | null;
  statusLabel?: string;
  deadlineLabel?: string;
  committee?: string | null;
  skriftligInnspillUrl?: string | null;
};

type HearingsOutput = {
  found?: boolean;
  issueId?: string | null;
  hearings?: HearingItem[];
  note?: string | null;
};

type SakTimelineOutput = {
  found?: boolean;
  issueId?: string | null;
  note?: string | null;
  title?: string;
  statusLabel?: string;
  voting?: {
    isOpen?: boolean;
    closesAt?: string | null;
    daysLeft?: number | null;
    daysLeftLabel?: string | null;
  };
  steps?: Array<{
    name?: string;
    events?: Array<{ id?: string | null; date?: string | null; text?: string | null }>;
  }>;
};

type SakDocumentsOutput = {
  found?: boolean;
  issueId?: string | null;
  total?: number;
  note?: string | null;
  groups?: Array<{
    kind?: string;
    label?: string;
    documents?: Array<{ id?: string; title?: string; sourceUrl?: string | null; viewable?: boolean }>;
  }>;
};

type FolketsMeningerOutput = {
  found?: boolean;
  issueId?: string | null;
  total?: number;
  note?: string | null;
  counts?: { for?: number; blank?: number; imot?: number; total?: number } | null;
  latest?: Array<{
    id?: string;
    title?: string;
    stance?: string;
    authorName?: string | null;
    createdAt?: string;
  }>;
};

type PoliticianOutput = {
  matches?: Array<{
    id?: string;
    name?: string;
    parti?: string | null;
    fylke?: string | null;
    tittel?: string | null;
    erRegjeringsmedlem?: boolean;
  }>;
  note?: string | null;
};

type PollResultsOutput = {
  found?: boolean;
  pollId?: string | null;
  title?: string | null;
  summary?: string | null;
  status?: string | null;
  track?: string | null;
  stortingetIssueId?: string | null;
  isOpen?: boolean;
  closesAt?: string | null;
  totals?: { ja?: number; nei?: number; blank?: number; total?: number };
  percents?: { ja?: number; nei?: number; blank?: number };
  byFylke?: Array<{
    code?: string;
    name?: string;
    ja?: number | null;
    nei?: number | null;
    blank?: number | null;
    total?: number;
    sufficientData?: boolean;
  }>;
  fylkeMinVotes?: number;
  note?: string | null;
};

type MyActivityOutput = {
  found?: boolean;
  signedIn?: boolean;
  points?: number;
  tierName?: string | null;
  progress?: {
    progressLabel?: string;
    progressPercent?: number;
    nextUnlock?: string | null;
    isMaxTier?: boolean;
  };
  stanceCount?: number;
  recentStances?: Array<{
    issueId?: string;
    title?: string | null;
    stance?: string;
    updatedAt?: string;
  }>;
  badges?: Array<{ id?: string; name?: string; earnedAt?: string | null }>;
  note?: string | null;
};

type ImpactOutput = {
  found?: boolean;
  issueId?: string | null;
  hasProfile?: boolean;
  profileLabels?: string[];
  result?: {
    headline?: string;
    personalSummary?: string;
    annualAmountKr?: number | null;
    direction?: string;
    confidence?: string;
    disclaimer?: string;
    effects?: Array<{
      id?: string;
      title?: string;
      summary?: string;
      appliesToUser?: boolean;
      audienceLabel?: string;
      direction?: string;
      annualAmountKr?: number | null;
      evidence?: string;
    }>;
  } | null;
  note?: string | null;
};

type PublicProfileOutput = {
  found?: boolean;
  signedIn?: boolean;
  displayName?: string | null;
  initials?: string | null;
  isStemmePlusSupporter?: boolean;
  note?: string | null;
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
                {chunk.documentId ? (
                  <Link
                    href={`${routes.sak(issue.id!)}?dokument=${encodeURIComponent(chunk.documentId)}`}
                    className="inline-flex items-center gap-1 hover:text-brand hover:underline"
                  >
                    Dokumentutdrag {(chunk.chunkIndex ?? index) + 1}
                    <ExternalLink className="size-2.5" aria-hidden />
                  </Link>
                ) : (
                  `Dokumentutdrag ${(chunk.chunkIndex ?? index) + 1}`
                )}
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

function HearingsCard({
  output,
  fallbackTitle,
}: {
  output: HearingsOutput;
  fallbackTitle: string;
}) {
  const hearings = output.hearings ?? [];
  if (hearings.length === 0) {
    return (
      <ToolCard icon={CalendarClock} title={fallbackTitle} tone="muted">
        {output.note || 'Ingen høringer funnet.'}
      </ToolCard>
    );
  }
  return (
    <ToolCard icon={CalendarClock} title={fallbackTitle} tone="brand">
      <ul className="space-y-2">
        {hearings.map((hearing) =>
          hearing.id ? (
            <li key={hearing.id} className="space-y-0.5">
              <Link
                href={routes.horing(hearing.id)}
                className="text-xs font-medium text-foreground hover:text-brand hover:underline"
              >
                {hearing.title || `Høring ${hearing.id}`}
              </Link>
              <p className="text-xs text-muted-foreground">
                {hearing.statusLabel || 'Høring'}
                {hearing.deadlineLabel ? ` · ${hearing.deadlineLabel}` : ''}
                {hearing.committee ? ` · ${hearing.committee}` : ''}
              </p>
            </li>
          ) : null,
        )}
      </ul>
    </ToolCard>
  );
}

function SakTimelineCard({ output }: { output: SakTimelineOutput }) {
  if (output.found === false || !output.issueId) {
    return (
      <ToolCard icon={Clock} title="Fant ingen saksgang" tone="muted">
        {output.note || 'Fant ingen sak å hente saksgang for.'}
      </ToolCard>
    );
  }

  const voting = output.voting ?? {};
  const steps = output.steps ?? [];

  return (
    <ToolCard
      icon={Clock}
      title={output.title || `Sak ${output.issueId}`}
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
      {output.statusLabel ? (
        <p className="text-xs text-foreground">
          <span className="font-medium text-muted-foreground">Status: </span>
          {output.statusLabel}
        </p>
      ) : null}
      {voting.isOpen ? (
        <p className="text-xs text-muted-foreground">
          {voting.daysLeftLabel || 'Åpen for stemmer'}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Ingen åpen voteringsfrist.</p>
      )}
      {steps.length > 0 ? (
        <ul className="space-y-1">
          {steps.slice(0, 6).map((step, index) => (
            <li key={`${step.name ?? 'steg'}-${index}`} className="text-xs">
              <span className="font-medium text-foreground">{step.name || `Steg ${index + 1}`}</span>
              {(step.events ?? []).length > 0 ? (
                <span className="text-muted-foreground">
                  {' '}
                  · {(step.events ?? [])
                    .map((event) => event.text || event.id)
                    .filter(Boolean)
                    .slice(0, 3)
                    .join(', ')}
                </span>
              ) : null}
            </li>
          ))}
          {steps.length > 6 ? (
            <li className="text-xs text-muted-foreground">+ {steps.length - 6} steg til.</li>
          ) : null}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Ingen saksgang-hendelser er publisert ennå.</p>
      )}
    </ToolCard>
  );
}

function SakDocumentsCard({ output }: { output: SakDocumentsOutput }) {
  if (output.found === false || !output.issueId) {
    return (
      <ToolCard icon={FileText} title="Fant ingen dokumenter" tone="muted">
        {output.note || 'Fant ingen sak å hente dokumenter for.'}
      </ToolCard>
    );
  }

  const groups = output.groups ?? [];

  return (
    <ToolCard
      icon={FileText}
      title="Dokumenter i saken"
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
      {groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {output.note || 'Ingen dokumenter er registrert på saken ennå.'}
        </p>
      ) : (
        groups.map((group, index) => (
          <div key={group.kind ?? index} className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground">
              {group.label || group.kind} ({(group.documents ?? []).length})
            </p>
            <ul className="space-y-0.5">
              {(group.documents ?? []).slice(0, 5).map((doc) => (
                <li key={doc.id ?? doc.title} className="text-xs">
                  {doc.id ? (
                    <Link
                      href={`${routes.sak(output.issueId!)}?dokument=${encodeURIComponent(doc.id)}`}
                      className="text-foreground hover:text-brand hover:underline"
                    >
                      {doc.title || doc.id}
                    </Link>
                  ) : (
                    <span className="text-foreground">{doc.title || 'Dokument'}</span>
                  )}
                </li>
              ))}
              {(group.documents ?? []).length > 5 ? (
                <li className="text-xs text-muted-foreground">
                  + {(group.documents ?? []).length - 5} til.
                </li>
              ) : null}
            </ul>
          </div>
        ))
      )}
    </ToolCard>
  );
}

const STANCE_LABELS: Record<string, string> = {
  for: 'For',
  imot: 'Imot',
  blank: 'Blank',
};

function FolketsMeningerCard({ output }: { output: FolketsMeningerOutput }) {
  if (output.found === false || !output.issueId) {
    return (
      <ToolCard icon={MessageSquare} title="Fant ingen meninger" tone="muted">
        {output.note || 'Fant ingen sak å hente meninger for.'}
      </ToolCard>
    );
  }

  const counts = output.counts ?? null;
  const latest = output.latest ?? [];

  return (
    <ToolCard
      icon={MessageSquare}
      title={`Folkets meninger (${output.total ?? 0})`}
      tone="brand"
      action={
        <Link
          href={routes.folketsMeningerForSak(output.issueId)}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
        >
          Åpne
          <ExternalLink className="size-3" aria-hidden />
        </Link>
      }
    >
      {counts ? (
        <p className="text-xs text-foreground">
          <span className="font-medium text-muted-foreground">For {counts.for ?? 0} · Blank{' '}
          {counts.blank ?? 0} · Imot {counts.imot ?? 0}</span>
        </p>
      ) : null}
      {latest.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {output.note || 'Ingen meninger er sendt inn om denne saken ennå.'}
        </p>
      ) : (
        <ul className="space-y-1">
          {latest.map((opinion) =>
            opinion.id ? (
              <li key={opinion.id} className="text-xs">
                <Link
                  href={routes.opinion(opinion.id)}
                  className="font-medium text-foreground hover:text-brand hover:underline"
                >
                  {opinion.title || 'Mening'}
                </Link>
                <span className="text-muted-foreground">
                  {opinion.stance ? ` · ${STANCE_LABELS[opinion.stance] ?? opinion.stance}` : ''}
                  {opinion.authorName ? ` · ${opinion.authorName}` : ''}
                </span>
              </li>
            ) : null,
          )}
        </ul>
      )}
    </ToolCard>
  );
}

function PoliticianCard({ output }: { output: PoliticianOutput }) {
  const matches = output.matches ?? [];
  if (matches.length === 0) {
    return (
      <ToolCard icon={Users} title="Fant ingen politikere" tone="muted">
        {output.note || 'Fant ingen politiker som matcher.'}
      </ToolCard>
    );
  }
  return (
    <ToolCard icon={Users} title={matches.length === 1 ? 'Politiker' : `${matches.length} politikere`} tone="brand">
      <ul className="space-y-1">
        {matches.map((politician) =>
          politician.id ? (
            <li key={politician.id} className="text-xs">
              <Link
                href={routes.politiker(politician.id)}
                className="font-medium text-foreground hover:text-brand hover:underline"
              >
                {politician.name || 'Politiker'}
              </Link>
              <span className="text-muted-foreground">
                {politician.parti ? ` · ${politician.parti}` : ''}
                {politician.fylke ? ` · ${politician.fylke}` : ''}
                {politician.erRegjeringsmedlem
                  ? ` · ${politician.tittel || 'regjeringsmedlem'}`
                  : politician.tittel
                    ? ` · ${politician.tittel}`
                    : ''}
              </span>
            </li>
          ) : null,
        )}
      </ul>
    </ToolCard>
  );
}

function formatKr(amount: number): string {
  const sign = amount < 0 ? '−' : '';
  return `${sign}${Math.abs(amount).toLocaleString('nb-NO')} kr`;
}

function PollResultsCard({ output }: { output: PollResultsOutput }) {
  if (output.found === false || !output.pollId) {
    return (
      <ToolCard icon={Vote} title="Fant ingen avstemning" tone="muted">
        {output.note || 'Fant ingen åpen eller avsluttet avstemning som passer.'}
      </ToolCard>
    );
  }

  const totals = output.totals ?? {};
  const percents = output.percents ?? {};
  const byFylke = (output.byFylke ?? []).filter((row) => row.sufficientData);

  return (
    <ToolCard
      icon={Vote}
      title={output.title || 'Avstemning'}
      tone="brand"
      action={
        <Link
          href={routes.poll(output.pollId)}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
        >
          Åpne
          <ExternalLink className="size-3" aria-hidden />
        </Link>
      }
    >
      {output.summary ? <p className="text-xs text-muted-foreground">{output.summary}</p> : null}
      <p className="text-xs text-foreground">
        <span className="font-medium text-muted-foreground">
          {output.isOpen ? 'Åpen' : 'Avsluttet'}
          {typeof totals.total === 'number' ? ` · ${totals.total} stemmer` : ''}:{' '}
        </span>
        Ja {percents.ja ?? 0}% ({totals.ja ?? 0}) · Nei {percents.nei ?? 0}% ({totals.nei ?? 0}) ·
        Blank {percents.blank ?? 0}% ({totals.blank ?? 0})
      </p>
      {output.note ? <p className="text-xs text-muted-foreground">{output.note}</p> : null}
      {byFylke.length > 0 ? (
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">
            Fylke med nok stemmer (minst {output.fylkeMinVotes ?? 0})
          </p>
          <ul className="space-y-0.5">
            {byFylke.slice(0, 8).map((row, index) => (
              <li key={row.code ?? row.name ?? index} className="text-xs text-foreground">
                {row.name || row.code || 'Fylke'}
                <span className="text-muted-foreground">
                  {' '}
                  · {row.total ?? 0} stemmer
                  {row.ja != null ? ` · Ja ${row.ja}` : ''}
                  {row.nei != null ? ` · Nei ${row.nei}` : ''}
                </span>
              </li>
            ))}
          </ul>
          {byFylke.length > 8 ? (
            <p className="text-xs text-muted-foreground">
              + {byFylke.length - 8} fylker med nok stemmer.
            </p>
          ) : null}
        </div>
      ) : totals.total ? (
        <p className="text-xs text-muted-foreground">
          Ingen fylker har nådd terskelen ennå, så fylkesfordelingen vises ikke.
        </p>
      ) : null}
    </ToolCard>
  );
}

function MyActivityCard({ output }: { output: MyActivityOutput }) {
  if (output.found === false && output.signedIn === false) {
    return (
      <ToolCard icon={Award} title="Ikke logget inn" tone="muted">
        {output.note || 'Logg inn for å se aktiviteten din.'}
      </ToolCard>
    );
  }
  if (output.found === false) {
    return (
      <ToolCard icon={Award} title="Aktivitet utilgjengelig" tone="muted">
        {output.note || 'Aktivitetsdata er ikke tilgjengelig akkurat nå.'}
      </ToolCard>
    );
  }

  const progress = output.progress ?? {};
  const stances = output.recentStances ?? [];
  const badges = output.badges ?? [];

  return (
    <ToolCard icon={Award} title="Din aktivitet" tone="brand">
      <p className="text-xs text-foreground">
        <span className="font-medium text-muted-foreground">Poeng: </span>
        {output.points ?? 0}
        {output.tierName ? ` · ${output.tierName}` : ''}
        {typeof progress.progressPercent === 'number'
          ? ` · ${progress.progressLabel ?? ''} (${progress.progressPercent}%)`
          : ''}
      </p>
      {!progress.isMaxTier && progress.nextUnlock ? (
        <p className="text-xs text-muted-foreground">Neste: {progress.nextUnlock}</p>
      ) : null}
      <p className="text-xs text-foreground">
        <span className="font-medium text-muted-foreground">Standpunkter: </span>
        {output.stanceCount ?? 0}
      </p>
      {stances.length > 0 ? (
        <ul className="space-y-0.5">
          {stances.map((stance, index) =>
            stance.issueId ? (
              <li key={`${stance.issueId}-${index}`} className="text-xs">
                <Link
                  href={routes.sak(stance.issueId)}
                  className="font-medium text-foreground hover:text-brand hover:underline"
                >
                  {stance.title || `Sak ${stance.issueId}`}
                </Link>
                <span className="text-muted-foreground">
                  {stance.stance ? ` · ${STANCE_LABELS[stance.stance] ?? stance.stance}` : ''}
                </span>
              </li>
            ) : null,
          )}
        </ul>
      ) : null}
      {badges.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <li
              key={badge.id ?? badge.name}
              className="rounded-full border border-brand/25 bg-brand/5 px-2 py-0.5 text-xs font-medium text-brand"
            >
              {badge.name || badge.id}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{output.note || 'Ingen merker ennå.'}</p>
      )}
    </ToolCard>
  );
}

function ImpactCard({ output }: { output: ImpactOutput }) {
  if (output.found === false || !output.issueId) {
    return (
      <ToolCard icon={Calculator} title="Fant ingen sak" tone="muted">
        {output.note || 'Fant ingen sak å beregne konsekvens for.'}
      </ToolCard>
    );
  }

  const result = output.result ?? null;

  return (
    <ToolCard
      icon={Calculator}
      title="Hva betyr saken for deg?"
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
      {(output.profileLabels ?? []).length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {(output.profileLabels ?? []).map((label) => (
            <li
              key={label}
              className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-xs text-muted-foreground"
            >
              {label}
            </li>
          ))}
        </ul>
      ) : null}
      {result?.headline ? (
        <p className="text-sm font-medium text-foreground">{result.headline}</p>
      ) : null}
      {result?.personalSummary ? (
        <p className="text-xs text-muted-foreground">{result.personalSummary}</p>
      ) : null}
      {result?.annualAmountKr != null ? (
        <p className="text-xs text-foreground">
          <span className="font-medium text-muted-foreground">Anslag: </span>
          {formatKr(result.annualAmountKr)} i året
        </p>
      ) : null}
      {(result?.effects ?? []).length > 0 ? (
        <ul className="space-y-1">
          {(result?.effects ?? []).slice(0, 4).map((effect, index) => (
            <li key={effect.id ?? index} className="text-xs">
              <span className="font-medium text-foreground">{effect.title || 'Effekt'}</span>
              <span className="text-muted-foreground">
                {effect.appliesToUser ? ' · gjelder deg' : ''}
                {effect.annualAmountKr != null ? ` · ${formatKr(effect.annualAmountKr)}` : ''}
              </span>
              {effect.summary ? (
                <p className="mt-0.5 text-muted-foreground">{effect.summary}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {result?.disclaimer ? (
        <p className="text-xs text-muted-foreground">{result.disclaimer}</p>
      ) : output.note ? (
        <p className="text-xs text-muted-foreground">{output.note}</p>
      ) : null}
    </ToolCard>
  );
}

function PublicProfileCard({ output }: { output: PublicProfileOutput }) {
  if (output.found === false) {
    return (
      <ToolCard icon={UserRound} title={output.signedIn === false ? 'Ikke logget inn' : 'Ingen profil'} tone="muted">
        {output.note || 'Ingen offentlig profil å vise.'}
      </ToolCard>
    );
  }

  return (
    <ToolCard icon={UserRound} title="Din offentlige profil" tone="brand">
      <div className="flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
          {output.initials || '?'}
        </span>
        <span className="text-sm font-medium text-foreground">
          {output.displayName || 'Uten visningsnavn'}
        </span>
        {output.isStemmePlusSupporter ? (
          <span className="rounded-full border border-brand/25 bg-brand/5 px-2 py-0.5 text-xs font-medium text-brand">
            Stemme+
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {output.note ||
          'Dette er feltene andre ser. Bio, parti og aktivitetsdeling styres i profilinnstillingene.'}
      </p>
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
    case 'tool-findHearingsForSak':
      return <HearingsCard output={output as HearingsOutput} fallbackTitle="Høringer for saken" />;
    case 'tool-listOpenHearings':
      return <HearingsCard output={output as HearingsOutput} fallbackTitle="Åpne høringer" />;
    case 'tool-getSakTimeline':
      return <SakTimelineCard output={output as SakTimelineOutput} />;
    case 'tool-listSakDocuments':
      return <SakDocumentsCard output={output as SakDocumentsOutput} />;
    case 'tool-getFolketsMeninger':
      return <FolketsMeningerCard output={output as FolketsMeningerOutput} />;
    case 'tool-getPolitician':
      return <PoliticianCard output={output as PoliticianOutput} />;
    case 'tool-getPollResults':
      return <PollResultsCard output={output as PollResultsOutput} />;
    case 'tool-getMyActivity':
      return <MyActivityCard output={output as MyActivityOutput} />;
    case 'tool-getImpact':
      return <ImpactCard output={output as ImpactOutput} />;
    case 'tool-getPublicProfile':
      return <PublicProfileCard output={output as PublicProfileOutput} />;
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