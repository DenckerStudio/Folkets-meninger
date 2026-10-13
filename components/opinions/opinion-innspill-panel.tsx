'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileSignature, Loader2, Scale } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { innspillStatusLabel } from '@/lib/innspill/types';
import { routes } from '@/lib/routes';
import { formatNumber } from '@/lib/utils';

type OpinionInnspillPanelProps = {
  opinionId: string;
  issueId: string | null;
  isAuthor: boolean;
  status: string | null;
  supportCount: number;
  supportThreshold: number;
  hearingTitle: string | null;
  hearingDeadlineLabel: string | null;
  endorsedByViewer: boolean;
  packagedAt: string | null;
};

export function OpinionInnspillPanel({
  opinionId,
  issueId,
  isAuthor,
  status,
  supportCount,
  supportThreshold,
  hearingTitle,
  hearingDeadlineLabel,
  endorsedByViewer,
  packagedAt,
}: OpinionInnspillPanelProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!user) {
      router.push(`${routes.login}?next=${encodeURIComponent(routes.opinion(opinionId))}`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/opinions/${opinionId}/innspill`, { method: 'POST' });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || 'Kunne ikke fremme innspillet');
        return;
      }
      router.refresh();
    } catch {
      setError('En feil oppstod');
    } finally {
      setBusy(false);
    }
  };

  const endorse = async () => {
    if (!user) {
      router.push(`${routes.login}?next=${encodeURIComponent(routes.opinion(opinionId))}`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/opinions/${opinionId}/innspill/endorse`, { method: 'POST' });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || 'Kunne ikke registrere støtte');
        return;
      }
      router.refresh();
    } catch {
      setError('En feil oppstod');
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    if (!isAuthor || !issueId) return null;
    return (
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Scale className="h-5 w-5 text-brand" />
          Fremm som innspill til høring
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Er denne meningen konkret nok til et innspill? Fremm den, så samler vi støtte fra andre
          innbyggere før den pakkes og sendes videre.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Offisielt innspill sendes alltid via stortinget.no — dette er et borgeraggregat.
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
          Fremm som innspill
        </button>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </section>
    );
  }

  return (
    <section
      data-opinion-innspill=""
      className="rounded-2xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Scale className="h-5 w-5 text-brand" />
          Innspill til høring
        </h2>
        <span
          className={
            status === 'packaged'
              ? 'inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand'
              : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
          }
        >
          {innspillStatusLabel(status as Parameters<typeof innspillStatusLabel>[0])}
        </span>
      </div>

      {hearingTitle ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Høring: {hearingTitle}
          {hearingDeadlineLabel ? ` — innspillsfrist ${hearingDeadlineLabel}` : ''}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="min-w-[10rem] flex-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Støtte</span>
            <span>
              {formatNumber(supportCount)} av {formatNumber(supportThreshold)}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-[width]"
              style={{
                width: `${Math.min(100, supportThreshold > 0 ? (supportCount / supportThreshold) * 100 : 0)}%`,
              }}
            />
          </div>
        </div>

        {status !== 'packaged' && status !== 'withdrawn' ? (
          <button
            type="button"
            onClick={endorse}
            disabled={busy}
            data-chat-action={endorsedByViewer ? 'unendorse-innspill' : 'endorse-innspill'}
            className={
              endorsedByViewer
                ? 'inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:border-brand/40'
                : 'inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90'
            }
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {endorsedByViewer ? 'Støtter allerede' : 'Støtt innspillet'}
          </button>
        ) : null}
      </div>

      {status === 'threshold_met' ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Terskelen er nådd. Innspillet pakkes og sendes videre ved neste kjøring.
        </p>
      ) : null}
      {status === 'packaged' && packagedAt ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Pakket {new Date(packagedAt).toLocaleDateString('nb-NO')}.
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">
        Et innspill fra Folkets Meninger er ikke sendt inn via Stortingets system.
      </p>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
