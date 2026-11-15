'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/empty-state';
import { ValgomatConsentPrompt } from '@/components/valgomat/valgomat-consent-prompt';
import { MotionList, MotionListRow } from '@/components/motion/list-row';
import { cn } from '@/lib/utils';
import { getPartyLogoSrc } from '@/lib/party-logos';
import { routes } from '@/lib/routes';
import { ISSUE_STANCE_LABELS } from '@/lib/stances/types';
import { parseValgomatApiResponse } from '@/lib/valgomat/api-client';
import {
  VALGOMAT_MIN_PERCENT_COMPARABLE,
  VALGOMAT_SMALL_SAMPLE_COMPARABLE,
} from '@/lib/valgomat/alignment';
import type { ValgomatPartySummary } from '@/lib/valgomat/alignment';
import type { ValgomatPayload } from '@/lib/valgomat/types';

type ValgomatTab = 'hjertesaker' | 'partisamsvar';

type ValgomatClientProps = {
  initialTab?: ValgomatTab;
};

type FetchState =
  | { status: 'loading' }
  | { status: 'consent_required' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ValgomatPayload };

const TABS: { id: ValgomatTab; label: string }[] = [
  { id: 'hjertesaker', label: 'Hjertesaker' },
  { id: 'partisamsvar', label: 'Partisamsvar' },
];

function partyVoteLabel(vote: 'for' | 'mot'): string {
  return vote === 'for' ? 'For' : 'Mot';
}

function PartyDetailPanel({
  summary,
  detailHeadingId,
  panelRef,
}: {
  summary: ValgomatPartySummary;
  detailHeadingId: string;
  panelRef?: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={panelRef}
      className="mt-2 space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <h3 id={detailHeadingId} className="text-base font-semibold text-foreground">
        {summary.party_name} — sak for sak
      </h3>
      {summary.agreement_percent === null &&
      summary.comparable < VALGOMAT_MIN_PERCENT_COMPARABLE ? (
        <p className="text-xs text-muted-foreground">
          Prosent vises først når minst {VALGOMAT_MIN_PERCENT_COMPARABLE} saker kan sammenlignes.
        </p>
      ) : null}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {summary.issues.map((issue) => (
          <li key={`${issue.stortinget_issue_id}-${issue.votering_tema}`} className="px-3 py-3">
            <Link
              href={routes.sak(issue.stortinget_issue_id)}
              className="line-clamp-2 rounded text-sm font-medium text-foreground hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              {issue.title || `Sak ${issue.stortinget_issue_id}`}
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">{issue.votering_tema}</p>
            <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Du</dt>
                <dd className="font-medium text-foreground">{ISSUE_STANCE_LABELS[issue.user_stance]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{summary.party_name}</dt>
                <dd className="font-medium text-foreground">{partyVoteLabel(issue.party_vote)}</dd>
              </div>
            </dl>
            <p
              className={cn(
                'mt-2 text-xs font-medium',
                issue.aligns ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
              )}
            >
              {issue.aligns ? 'Stemmer overens' : 'Stemmer ikke overens'}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ValgomatClient({ initialTab = 'hjertesaker' }: ValgomatClientProps) {
  const [activeTab, setActiveTab] = useState<ValgomatTab>(initialTab);
  const [fetchState, setFetchState] = useState<FetchState>({ status: 'loading' });
  const [selectedParty, setSelectedParty] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [partyPanelAnnouncement, setPartyPanelAnnouncement] = useState('');
  const tabListId = useId();
  const partyPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/user/valgomat', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) => {
        const json = (await res.json()) as ValgomatPayload & { error?: string; code?: string };
        const parsed = parseValgomatApiResponse(res.status, json);
        if (cancelled) return;
        if (parsed.kind === 'consent_required') {
          setFetchState({ status: 'consent_required' });
          return;
        }
        if (parsed.kind === 'error') {
          setFetchState({ status: 'error', message: parsed.message });
          return;
        }
        setFetchState({ status: 'ready', data: parsed.data });
        setSelectedParty((prev) => {
          if (prev && parsed.data.partisamsvar.some((p) => p.party_code === prev)) return prev;
          return parsed.data.partisamsvar[0]?.party_code ?? null;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setFetchState({ status: 'error', message: 'Kunne ikke laste Valgomat' });
      });

    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  const retry = () => {
    setFetchState({ status: 'loading' });
    setReloadNonce((n) => n + 1);
  };

  const showTabs =
    fetchState.status === 'ready' && fetchState.data.stance_count > 0;

  const focusTab = useCallback((tabId: ValgomatTab) => {
    setActiveTab(tabId);
    const tabButton = document.getElementById(`${tabListId}-${tabId}`);
    if (tabButton instanceof HTMLButtonElement) {
      tabButton.focus();
    }
  }, [tabListId]);

  const handleTabListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = TABS.findIndex((tab) => tab.id === activeTab);
    if (currentIndex < 0) return;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowLeft': {
        event.preventDefault();
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = (currentIndex + delta + TABS.length) % TABS.length;
        focusTab(TABS[nextIndex].id);
        break;
      }
      case 'Home':
        event.preventDefault();
        focusTab(TABS[0].id);
        break;
      case 'End':
        event.preventDefault();
        focusTab(TABS[TABS.length - 1].id);
        break;
      default:
        break;
    }
  };

  const tabNav = showTabs ? (
    <div
      role="tablist"
      aria-label="Valgomat"
      className="flex flex-wrap gap-2"
      onKeyDown={handleTabListKeyDown}
    >
      {TABS.map((tab) => {
        const selected = activeTab === tab.id;
        const tabId = `${tabListId}-${tab.id}`;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tabId}
            aria-selected={selected}
            aria-controls={`${tabListId}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
              selected
                ? 'border-brand bg-brand text-white'
                : 'border-border bg-card text-foreground hover:bg-muted/50',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  ) : null;

  useEffect(() => {
    if (!selectedParty || activeTab !== 'partisamsvar') return;
    partyPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedParty, activeTab]);

  if (fetchState.status === 'loading') {
    return (
      <div className="space-y-6">
        {tabNav}
        <p role="status" className="py-10 text-center text-sm text-muted-foreground">
          Laster valgomat…
        </p>
      </div>
    );
  }

  if (fetchState.status === 'consent_required') {
    return (
      <div className="space-y-6">
        <ValgomatConsentPrompt onConsented={retry} />
      </div>
    );
  }

  if (fetchState.status === 'error') {
    return (
      <div className="space-y-6">
        {tabNav}
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center"
        >
          <p className="text-sm text-destructive">{fetchState.message}</p>
          <button
            type="button"
            onClick={retry}
            className={cn(
              'min-h-11 rounded-lg px-4 text-sm font-medium text-brand',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
            )}
          >
            Prøv igjen
          </button>
        </div>
      </div>
    );
  }

  const { data } = fetchState;

  if (data.stance_count === 0) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="Ingen holdninger ennå"
          description="Marker enig eller uenig på saker du bryr deg om. Da kan du se hjertesaker og sammenligne med hvordan partiene faktisk stemte."
          action={
            <Link
              href={routes.utforsk}
              className="inline-flex min-h-11 items-center rounded-lg font-medium text-brand underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Utforsk saker →
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {tabNav}
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {partyPanelAnnouncement}
      </p>

      <p className="text-sm text-muted-foreground">
        Basert på dine egne holdninger (enig/uenig). Dette er en sammenligning med Stortingets
        partivoteringer — ikke en anbefaling.
      </p>

      {activeTab === 'hjertesaker' ? (
        <section
          role="tabpanel"
          id={`${tabListId}-panel-hjertesaker`}
          aria-labelledby={`${tabListId}-hjertesaker`}
          className="space-y-3"
        >
          <h2 className="text-lg font-semibold text-foreground">Hjertesaker</h2>
          <MotionList className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {data.hjertesaker.map((item) => (
              <MotionListRow id={item.stortinget_issue_id} key={item.stortinget_issue_id}>
                <Link
                  href={routes.sak(item.stortinget_issue_id)}
                  className="group flex items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                      item.stance === 'enig' ? 'bg-brand/15 text-brand' : 'bg-destructive/15 text-destructive',
                    )}
                    aria-hidden
                  >
                    {item.stance === 'enig' ? (
                      <ThumbsUp className="h-4 w-4" />
                    ) : (
                      <ThumbsDown className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-sm font-medium text-foreground group-hover:text-brand">
                      {item.title || `Sak ${item.stortinget_issue_id}`}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {ISSUE_STANCE_LABELS[item.stance]} ·{' '}
                      {new Date(item.updated_at).toLocaleDateString('nb-NO')}
                    </span>
                  </span>
                </Link>
              </MotionListRow>
            ))}
          </MotionList>
        </section>
      ) : (
        <section
          role="tabpanel"
          id={`${tabListId}-panel-partisamsvar`}
          aria-labelledby={`${tabListId}-partisamsvar`}
          className="space-y-4"
        >
          <h2 className="text-lg font-semibold text-foreground">Partisamsvar</h2>

          {data.partisamsvar.length === 0 ? (
            <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
              <p>
                Du har {data.stance_count}{' '}
                {data.stance_count === 1 ? 'holdning' : 'holdninger'}, men ingen av sakene har
                partivotering vi kan sammenligne med ennå.
              </p>
              <Link
                href={routes.utforsk}
                className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                Utforsk saker på Stortinget →
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {data.partisamsvar.map((row) => {
                const logo = getPartyLogoSrc(row.party_name);
                const expanded = selectedParty === row.party_code;
                const detailHeadingId = `party-detail-${row.party_code}`;
                return (
                  <li key={row.party_code}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={expanded ? `${detailHeadingId}-panel` : undefined}
                      onClick={() => {
                        const next = expanded ? null : row.party_code;
                        setSelectedParty(next);
                        if (next) {
                          setPartyPanelAnnouncement(
                            `${row.party_name} — detaljer for partisamsvar er utvidet.`,
                          );
                        } else {
                          setPartyPanelAnnouncement('');
                        }
                      }}
                      className={cn(
                        'flex w-full min-h-11 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                        expanded ? 'border-brand bg-brand/5' : 'border-border bg-card hover:bg-muted/40',
                      )}
                    >
                      {logo ? (
                        <Image
                          src={logo}
                          alt=""
                          width={32}
                          height={32}
                          className="h-8 w-8 shrink-0 rounded-md object-contain"
                        />
                      ) : (
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold"
                          aria-hidden
                        >
                          {row.party_code}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">{row.party_name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {row.matching} av {row.comparable}{' '}
                          {row.comparable === 1 ? 'sak' : 'saker'} stemmer overens
                          {row.agreement_percent !== null ? ` · ${row.agreement_percent} %` : null}
                        </span>
                        {row.small_sample ? (
                          <span className="mt-1 block text-xs text-amber-800 dark:text-amber-200">
                            Lite grunnlag (færre enn {VALGOMAT_SMALL_SAMPLE_COMPARABLE}{' '}
                            sammenlignbare saker)
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {expanded ? (
                      <div id={`${detailHeadingId}-panel`}>
                        <PartyDetailPanel
                          summary={row}
                          detailHeadingId={detailHeadingId}
                          panelRef={(el) => {
                            if (row.party_code === selectedParty) {
                              partyPanelRef.current = el;
                            }
                          }}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}