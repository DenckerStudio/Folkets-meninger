'use client';

import { BookOpen } from 'lucide-react';
import { AdminBackLink } from '@/components/admin/admin-shell';
import { PageHeader } from '@/components/page-header';
import type { AdminKildeOverview } from '@/lib/admin/kilder/overview';
import {
  adminCaptureSourceTypeLabel,
  adminRagCorpusLabel,
  adminRagDocumentTypeLabel,
} from '@/lib/admin/kilder/source-type-labels';
const NOT_READY_MESSAGE =
  'Kildeoversikten er ikke klar i databasen ennå. Coolify Expert må kjøre backup og dry-run, deretter den ventende databasemigrasjonen.';

function formatNbDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatInt(n: number): string {
  return n.toLocaleString('nb-NO');
}

type Props = {
  initialData: AdminKildeOverview;
};

export default function AdminKilderClient({ initialData }: Props) {
  return (
    <div className="space-y-6">
      <AdminBackLink />
      <div className="flex items-start gap-3">
        <BookOpen className="mt-1 h-6 w-6 shrink-0 text-brand" aria-hidden />
        <PageHeader
          as="h2"
          title="Kilder"
          description="Oversikt over dokumenter, tekstbiter og oppfangede kilder i databasen."
        />
      </div>

      {!initialData.ready ? (
        <p
          role="status"
          className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground"
        >
          {NOT_READY_MESSAGE}
        </p>
      ) : (
        <>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Siste tekstbit
              </dt>
              <dd className="mt-1 text-sm text-foreground">{formatNbDate(initialData.lastChunkAt)}</dd>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Siste sak-dokument
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {formatNbDate(initialData.lastIssueDocumentFetchAt)}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Siste høringsdokument
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {formatNbDate(initialData.lastHearingDocumentUpdateAt)}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Generert
              </dt>
              <dd className="mt-1 text-sm text-foreground">{formatNbDate(initialData.generatedAt)}</dd>
            </div>
          </dl>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">RAG-korpus (dokumenter og tekstbiter)</h3>
            <p className="text-sm text-muted-foreground">
              Gruppert etter dokumenttype og korpus. Perioder teller nye tekstbiter etter opprettelsestidspunkt.
            </p>
            {initialData.ragBySourceType.length === 0 ? (
              <p className="text-sm text-muted-foreground" role="status">
                Ingen tekstbiter i korpus ennå.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">
                        Dokumenttype
                      </th>
                      <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">
                        Korpus
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                        Dokumenter
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                        Tekstbiter
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                        7 d
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                        30 d
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                        90 d
                      </th>
                      <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">
                        Siste tekstbit
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialData.ragBySourceType.map((row) => (
                      <tr
                        key={`${row.corpus}-${row.sourceType}`}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-4 py-2.5 text-foreground">
                          {adminRagDocumentTypeLabel(row.sourceType)}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {adminRagCorpusLabel(row.corpus)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                          {formatInt(row.documentCount)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                          {formatInt(row.chunkCount)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                          {formatInt(row.chunks7d)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                          {formatInt(row.chunks30d)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                          {formatInt(row.chunks90d)}
                        </td>
                        <td className="px-4 py-2.5 text-foreground">{formatNbDate(row.lastChunkAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Oppfanget (aksjonskilder)</h3>
            <p className="text-sm text-muted-foreground">
              Antall kilder per type fra oppfangingspipen. Perioder basert på innhentingstidspunkt.
            </p>
            {initialData.captureBySourceType.length === 0 ? (
              <p className="text-sm text-muted-foreground" role="status">
                Ingen oppfangede kilder ennå.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">
                        Kildetype
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                        Kilder
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                        7 d
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                        30 d
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                        90 d
                      </th>
                      <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">
                        Siste innhenting
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialData.captureBySourceType.map((row) => (
                      <tr key={row.sourceType} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 text-foreground">
                          {adminCaptureSourceTypeLabel(row.sourceType)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                          {formatInt(row.sourceCount)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                          {formatInt(row.sources7d)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                          {formatInt(row.sources30d)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                          {formatInt(row.sources90d)}
                        </td>
                        <td className="px-4 py-2.5 text-foreground">{formatNbDate(row.lastFetchedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}