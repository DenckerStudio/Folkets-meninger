'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileText, Loader2, Sparkles, Vote, X } from 'lucide-react';
import UserSakVoteStatus from '@/components/forum/user-sak-vote-status';
import AiSummary from '@/app/dashboard/sak/[id]/ai-summary';
import VotingSection from '@/app/dashboard/sak/[id]/voting-section';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

export type SakQuickPanel = 'overview' | 'vote' | 'ai-summary';

const PANEL_META: Record<
  SakQuickPanel,
  { title: string; icon: typeof FileText }
> = {
  overview: { title: 'Sak', icon: FileText },
  vote: { title: 'Stem på saken', icon: Vote },
  'ai-summary': { title: 'AI-sammendrag', icon: Sparkles },
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

type SakOverviewDetail = {
  title: string;
  summary: string;
  excerpt: string | null;
  komite: string | null;
  statusLabel: string | null;
};

function SakOverviewPanel({
  sakId,
  sakTitle,
}: {
  sakId: string;
  sakTitle: string;
}) {
  const [detail, setDetail] = useState<SakOverviewDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/sak/${sakId}`)
      .then((res) => {
        if (!res.ok) throw new Error('not_found');
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        const title = json.korttittel || json.tittel || sakTitle;
        const summary = json.tittel || sakTitle;
        const rawText =
          json.innstillingstekst || json.kortvedtak || json.parentestekst || '';
        const excerpt = rawText ? stripHtml(String(rawText)).slice(0, 480) : null;
        setDetail({
          title,
          summary,
          excerpt: excerpt && excerpt.length > 0 ? excerpt : null,
          komite: json.komite?.navn ?? null,
          statusLabel: json.ferdigbehandlet ? 'Ferdig behandlet' : 'Under behandling',
        });
      })
      .catch(() => {
        if (!cancelled) {
          setError('Kunne ikke hente saksdetaljer.');
          setDetail({
            title: sakTitle,
            summary: sakTitle,
            excerpt: null,
            komite: null,
            statusLabel: null,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sakId, sakTitle]);

  if (!detail) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Henter sak…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-amber-700">{error}</p>}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
          {detail.statusLabel || 'Stortingssak'}
        </p>
        <h3 className="mt-1 text-xl font-bold text-gray-900">{detail.title}</h3>
        {detail.komite && (
          <p className="mt-2 text-sm text-gray-600">Komité: {detail.komite}</p>
        )}
      </div>
      <p className="text-sm leading-relaxed text-gray-700">{detail.summary}</p>
      {detail.excerpt && (
        <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-600 ring-1 ring-gray-100">
          {detail.excerpt}
          {detail.excerpt.length >= 480 ? '…' : ''}
        </p>
      )}
    </div>
  );
}

type SakQuickActionModalProps = {
  sakId: string;
  sakTitle: string;
  panel: SakQuickPanel;
  open: boolean;
  onClose: () => void;
};

export function SakQuickActionModal({
  sakId,
  sakTitle,
  panel,
  open,
  onClose,
}: SakQuickActionModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const meta = PANEL_META[panel];
  const Icon = meta.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-[2px]"
        aria-label="Lukk"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative z-10 flex w-full max-h-[min(90vh,720px)] flex-col overflow-hidden',
          'rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:max-w-2xl sm:rounded-2xl',
          panel === 'ai-summary' && 'sm:max-w-3xl'
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <h2 id={titleId} className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Icon className="h-5 w-5 text-indigo-600" aria-hidden />
            {meta.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
            aria-label="Lukk dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {panel === 'overview' && (
            <SakOverviewPanel key={sakId} sakId={sakId} sakTitle={sakTitle} />
          )}

          {panel === 'vote' && (
            <VotingSection
              sakId={sakId}
              sakTitle={sakTitle}
              sakSummary={sakTitle}
              initialVotes={{ for: 0, against: 0, abstain: 0, total: 0 }}
            />
          )}

          {panel === 'ai-summary' && (
            <AiSummary sakId={sakId} title={sakTitle} summary={sakTitle} />
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 px-5 py-4">
          <Link
            href={
              panel === 'ai-summary'
                ? `${routes.sak(sakId)}#ai-summary`
                : routes.sak(sakId)
            }
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500"
            onClick={onClose}
          >
            <ExternalLink className="h-4 w-4" />
            Åpne full saksvisning
          </Link>
        </div>
      </div>
    </div>
  );
}

type SakQuickActionLinksProps = {
  sakId: string;
  sakTitle: string;
};

export function SakQuickActionLinks({ sakId, sakTitle }: SakQuickActionLinksProps) {
  const [panel, setPanel] = useState<SakQuickPanel | null>(null);

  const open = useCallback((next: SakQuickPanel) => setPanel(next), []);
  const close = useCallback(() => setPanel(null), []);

  const linkClass =
    'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100/80 hover:text-indigo-800';

  return (
    <>
      <button type="button" className={linkClass} onClick={() => open('overview')}>
        <FileText className="h-3.5 w-3.5" /> Se sak
      </button>
      <UserSakVoteStatus sakId={sakId} />
      <button type="button" className={linkClass} onClick={() => open('ai-summary')}>
        <Sparkles className="h-3.5 w-3.5" /> AI-sammendrag
      </button>

      {panel && (
        <SakQuickActionModal
          sakId={sakId}
          sakTitle={sakTitle}
          panel={panel}
          open
          onClose={close}
        />
      )}
    </>
  );
}
