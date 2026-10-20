'use client';

import Link from 'next/link';
import { ResearchRowActions } from '@/components/admin/research-row-actions';
import { formatOppfangetDateTime } from '@/app/dashboard/admin/oppfanget/oppfanget-row-views';
import type { OppfangetRow } from '@/lib/admin/oppfanget/types';
import type { ResearchBriefRow, ResearchPerspective } from '@/lib/admin/research/types';
import { adminBlogPostUrl } from '@/lib/blog/urls';
import { routes } from '@/lib/routes';

const STANCE_LABELS: Record<ResearchPerspective['stance'], string> = {
  for: 'For',
  mot: 'Mot',
  nøytral: 'Nøytral',
};

const STATUS_LABELS: Record<ResearchBriefRow['status'], string> = {
  queued: 'I kø',
  running: 'Kjører',
  done: 'Ferdig',
  failed: 'Feilet',
};

function outputLink(brief: ResearchBriefRow): { href: string; label: string } | null {
  if (!brief.output_ref || brief.status !== 'done') return null;
  if (brief.kind === 'blog') {
    const href = adminBlogPostUrl(brief.output_ref);
    if (!href) return null;
    return { href, label: 'Åpne bloggutkast i Payload' };
  }
  if (brief.kind === 'reel') {
    return { href: routes.adminReels, label: 'Åpne Reels-admin (utkast)' };
  }
  return null;
}

export function ResearchClusterDetailView({
  row,
  briefs,
  adminUserId,
}: {
  row: OppfangetRow;
  briefs: ResearchBriefRow[];
  adminUserId?: string;
}) {
  const latest = briefs[0] ?? null;
  const perspectives = latest?.perspectives ?? [];
  const byStance: Record<ResearchPerspective['stance'], ResearchPerspective[]> = {
    for: [],
    mot: [],
    nøytral: [],
  };
  for (const p of perspectives) {
    if (p.stance in byStance) byStance[p.stance].push(p);
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Handlinger</h2>
        <div className="mt-3 max-w-sm">
          <ResearchRowActions clusterId={row.id} userId={adminUserId} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground">Alle kilder</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {row.sources.length === 0 ? (
            <li className="text-muted-foreground">Ingen kilder registrert.</li>
          ) : (
            row.sources.map((s) => (
              <li key={s.id} className="rounded-lg border border-border px-3 py-2">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand hover:underline break-words"
                >
                  {s.title ?? s.url}
                </a>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.publisher ?? 'Ukjent utgiver'}
                  {s.signalOnly ? ' · signal' : ''}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Research-oppgaver</h2>
        {briefs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen research-oppgaver ennå.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {briefs.map((brief) => {
              const link = outputLink(brief);
              return (
                <li
                  key={brief.id}
                  className="rounded-lg border border-border bg-muted/20 px-3 py-2"
                >
                  <p className="font-medium">
                    {brief.kind} · {STATUS_LABELS[brief.status]}
                  </p>
                  {brief.error ? (
                    <p className="mt-1 text-destructive">{brief.error}</p>
                  ) : null}
                  {link ? (
                    <Link href={link.href} className="mt-1 inline-block text-brand hover:underline">
                      {link.label}
                    </Link>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Opprettet {formatOppfangetDateTime(brief.created_at)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {latest?.summary ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Siste research-sammendrag</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{latest.summary}</p>
        </section>
      ) : null}

      {perspectives.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Perspektiver</h2>
          {(['for', 'mot', 'nøytral'] as const).map((stance) =>
            byStance[stance].length > 0 ? (
              <div key={stance}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {STANCE_LABELS[stance]}
                </h3>
                <ul className="mt-2 space-y-3">
                  {byStance[stance].map((p, idx) => (
                    <li key={`${stance}-${idx}`} className="rounded-lg border border-border p-3 text-sm">
                      <p className="font-medium">{p.actor}</p>
                      <p className="mt-1 text-muted-foreground">{p.summary}</p>
                      {p.quotes?.length ? (
                        <ul className="mt-2 space-y-1 text-xs">
                          {p.quotes.map((q, qi) => (
                            <li key={qi}>
                              <span className="text-foreground">«{q.text}»</span>
                              {q.url ? (
                                <>
                                  {' '}
                                  <a
                                    href={q.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-brand hover:underline"
                                  >
                                    {q.publisher ?? 'Kilde'}
                                  </a>
                                </>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </section>
      ) : null}

      {latest?.sources?.length ? (
        <section>
          <h2 className="text-sm font-semibold text-foreground">Ekstra kilder fra research</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {latest.sources.map((s, i) => (
              <li key={i}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand hover:underline"
                >
                  {s.title ?? s.url}
                </a>
                {s.publisher ? (
                  <span className="text-muted-foreground"> · {s.publisher}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
