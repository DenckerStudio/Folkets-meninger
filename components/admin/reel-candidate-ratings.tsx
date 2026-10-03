import {
  hasStoredCandidateRatings,
  parseCandidateRatings,
} from '@/lib/polls/candidate-ratings';
import type { PollGenerationMetadata } from '@/lib/polls/types';

function formatAssessedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('nb-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ReelCandidateRatings({
  metadata,
}: {
  metadata: PollGenerationMetadata;
}) {
  const ratings = parseCandidateRatings(metadata);
  if (!hasStoredCandidateRatings(ratings) || !ratings) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-border px-3 py-2.5">
        <p className="text-xs font-medium text-foreground">AI-vurdering</p>
        <p className="mt-1 text-sm text-muted-foreground">Ingen AI-vurdering er lagret for dette utkastet.</p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <p className="text-xs font-medium text-foreground">AI-vurdering</p>
      <dl className="space-y-2 text-sm">
        {ratings.relevance ? (
          <div>
            <dt className="text-muted-foreground">Relevans for aktuelle samfunnsproblem</dt>
            <dd className="text-foreground">
              <span className="font-medium">{ratings.relevance.score}</span>
              {ratings.relevance.reason ? (
                <span className="mt-0.5 block text-muted-foreground">{ratings.relevance.reason}</span>
              ) : null}
            </dd>
          </div>
        ) : null}
        {ratings.date ? (
          <div>
            <dt className="text-muted-foreground">Dato</dt>
            <dd className="text-foreground">
              {ratings.date.value ?? 'Ukjent dato'}
              {ratings.date.withinLastYear === true ? (
                <span className="text-muted-foreground"> · Innen siste år</span>
              ) : null}
              {ratings.date.withinLastYear === false ? (
                <span className="text-muted-foreground"> · Eldre enn ett år</span>
              ) : null}
            </dd>
          </div>
        ) : null}
        {ratings.discussed ? (
          <div>
            <dt className="text-muted-foreground">
              Omtale{ratings.discussed.source ? ` (${ratings.discussed.source})` : ''}
            </dt>
            <dd className="text-foreground">
              {ratings.discussed.empty || ratings.discussed.hits.length === 0 ? (
                <span>Ingen omtale funnet.</span>
              ) : (
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {ratings.discussed.hits.map((hit, index) => (
                    <li key={hit.url ?? `${hit.title ?? 'hit'}-${index}`}>
                      {hit.url ? (
                        <a href={hit.url} className="text-brand hover:underline" target="_blank" rel="noreferrer">
                          {hit.title ?? hit.url}
                        </a>
                      ) : (
                        hit.title
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        ) : null}
        {ratings.assessedAt ? (
          <div>
            <dt className="text-muted-foreground">Vurdert</dt>
            <dd className="text-foreground">{formatAssessedAt(ratings.assessedAt)}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
