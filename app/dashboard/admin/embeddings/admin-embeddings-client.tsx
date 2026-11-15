'use client';

import type { ReactNode } from 'react';
import { Layers } from 'lucide-react';
import { AdminBackLink } from '@/components/admin/admin-shell';
import { PageHeader } from '@/components/page-header';
import type { AdminEmbeddingCoverage } from '@/lib/admin/embeddings/coverage';
const NOT_READY_MESSAGE =
  'Embedding-dekning er ikke klar i databasen ennå. Coolify Expert må kjøre backup og dry-run, deretter den ventende databasemigrasjonen.';

function formatNbDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatInt(n: number): string {
  return n.toLocaleString('nb-NO');
}

function formatPercentShare(share: number): string {
  if (!Number.isFinite(share)) return '—';
  return `${(share * 100).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} %`;
}

function StatusGrid({
  title,
  dimension,
  modelTag,
  ready,
  pending,
  failed,
  extra,
}: {
  title: string;
  dimension: number;
  modelTag?: string;
  ready: number;
  pending: number;
  failed: number;
  extra?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h4 className="font-semibold text-foreground">{title}</h4>
      <p className="text-sm text-muted-foreground">
        Dimensjon {formatInt(dimension)}
        {modelTag ? ` · modelltag ${modelTag}` : null}
      </p>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/40 p-3">
          <dt className="text-xs text-muted-foreground">Klar</dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">{formatInt(ready)}</dd>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <dt className="text-xs text-muted-foreground">Venter</dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">{formatInt(pending)}</dd>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <dt className="text-xs text-muted-foreground">Feilet</dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">{formatInt(failed)}</dd>
        </div>
      </dl>
      {extra}
    </div>
  );
}

type Props = {
  initialData: AdminEmbeddingCoverage;
};

export default function AdminEmbeddingsClient({ initialData }: Props) {
  const backlog = initialData.backlogHealth;
  const pendingV2Total =
    backlog && typeof backlog.pending_v2_total === 'number' ? backlog.pending_v2_total : null;

  return (
    <div className="space-y-6">
      <AdminBackLink />
      <div className="flex items-start gap-3">
        <Layers className="mt-1 h-6 w-6 shrink-0 text-brand" aria-hidden />
        <PageHeader
          as="h2"
          title="Embeddings"
          description="Dekning og køstatus for tekstvektorer i document_chunks."
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
          <p className="text-sm text-muted-foreground">
            Generert {formatNbDate(initialData.generatedAt)}. Tallene er lesetilgang mot produksjonsdata.
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            {initialData.legacy ? (
              <StatusGrid
                title="Legacy (nomic)"
                dimension={initialData.legacy.dimension}
                modelTag={initialData.legacy.modelTag}
                ready={initialData.legacy.ready}
                pending={initialData.legacy.pending}
                failed={initialData.legacy.failed}
                extra={
                  <p className="text-sm text-muted-foreground">
                    Siste klare vektor: {formatNbDate(initialData.legacy.lastReadyAt)}
                  </p>
                }
              />
            ) : null}

            {initialData.v2 ? (
              <StatusGrid
                title="v2 (bge-m3)"
                dimension={initialData.v2.dimension}
                ready={initialData.v2.ready}
                pending={initialData.v2.pending}
                failed={initialData.v2.failed}
                extra={
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Uten v2-vektor: {formatInt(initialData.v2.missingVector)}</p>
                    <p>Siste v2-kjøring: {formatNbDate(initialData.v2.lastRunAt)}</p>
                    {pendingV2Total !== null ? (
                      <p>Kø (pipeline-helse): {formatInt(pendingV2Total)} ventende v2</p>
                    ) : null}
                  </div>
                }
              />
            ) : null}
          </div>

          {initialData.v2 && initialData.v2.models.length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">Modelltagger (v2)</h3>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">
                        Modelltag
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                        Tekstbiter
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialData.v2.models.map((row) => (
                      <tr key={row.modelTag} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 font-mono text-xs text-foreground sm:text-sm">
                          {row.modelTag}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                          {formatInt(row.chunkCount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {initialData.issues ? (
            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">Saker uten tekstbiter</h3>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border bg-card p-4">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Saker totalt
                  </dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                    {formatInt(initialData.issues.total)}
                  </dd>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Med tekstbiter
                  </dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                    {formatInt(initialData.issues.withChunks)}
                  </dd>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Uten tekstbiter
                  </dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                    {formatInt(initialData.issues.withoutChunks)}
                  </dd>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Andel uten
                  </dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                    {formatPercentShare(initialData.issues.shareWithoutChunks)}
                  </dd>
                </div>
              </dl>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}