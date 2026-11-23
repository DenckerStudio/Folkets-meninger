'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Activity, CirclePause, CirclePlay } from 'lucide-react';
import { VURDER_FOCUS_RING } from '@/lib/admin/vurder-interaction-classes';
import type { LocalAiRunnerStatusResult } from '@/lib/admin/local-ai-hub/runner-status';
import { cn } from '@/lib/utils';

const POLL_MS = 8_000;

type BannerPhase = 'loading' | 'hidden' | 'ready';

export function LocalAiRunnerStatusBanner() {
  const [phase, setPhase] = useState<BannerPhase>('loading');
  const [status, setStatus] = useState<LocalAiRunnerStatusResult | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string | null>(null);
  const prevStatusLabelRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/admin/local-ai-hub/status', { cache: 'no-store' });
        if (res.status === 404) {
          if (!cancelled) setPhase('hidden');
          return;
        }
        const data = (await res.json()) as LocalAiRunnerStatusResult;
        if (cancelled) return;
        setStatus(data);
        setPhase('ready');
        if (data.available && data.statusLabel !== prevStatusLabelRef.current) {
          prevStatusLabelRef.current = data.statusLabel;
          setLiveAnnouncement(data.statusLabel);
        }
        if (!data.available) {
          prevStatusLabelRef.current = null;
        }
      } catch {
        if (!cancelled) {
          setStatus({ available: false });
          setPhase('ready');
          prevStatusLabelRef.current = null;
        }
      }
    };

    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (phase === 'hidden') {
    return null;
  }

  const iconClass = 'mt-0.5 h-5 w-5 shrink-0 text-brand';

  if (phase === 'loading') {
    return (
      <section
        aria-labelledby="lokal-ai-runner-status-heading"
        aria-busy="true"
        className="rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <h2 id="lokal-ai-runner-status-heading" className="sr-only">
          Runner-status
        </h2>
        <p className="sr-only">Laster status…</p>
        <div className="h-12 animate-pulse rounded bg-muted/60" aria-hidden />
      </section>
    );
  }

  const unavailable = status !== null && !status.available;

  return (
    <section
      aria-labelledby="lokal-ai-runner-status-heading"
      className="rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <h2 id="lokal-ai-runner-status-heading" className="sr-only">
        Runner-status
      </h2>
      {liveAnnouncement ? (
        <p className="sr-only" aria-live="polite" role="status">
          {liveAnnouncement}
        </p>
      ) : null}
      {unavailable ? (
        <p className="text-sm text-muted-foreground">Status utilgjengelig</p>
      ) : status?.available ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start gap-3">
            {status.state === 'running' ? (
              <CirclePlay className={iconClass} aria-hidden />
            ) : status.state === 'paused' ? (
              <CirclePause className={iconClass} aria-hidden />
            ) : (
              <Activity className={iconClass} aria-hidden />
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-semibold text-foreground">{status.statusLabel}</p>
              {status.state === 'running' && status.step ? (
                <p className="text-sm text-muted-foreground">
                  Steg: <span className="font-medium text-foreground">{status.step}</span>
                </p>
              ) : null}
              {status.state === 'running' && status.branch ? (
                <p className="text-xs text-muted-foreground">
                  Gren: <code className="text-foreground">{status.branch}</code>
                </p>
              ) : null}
              {status.state === 'running' && status.pr ? (
                <p className="text-sm">
                  <Link
                    href={status.pr.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'inline-flex min-h-11 items-center font-medium text-brand hover:underline',
                      VURDER_FOCUS_RING,
                    )}
                  >
                    PR #{status.pr.number}
                  </Link>
                </p>
              ) : null}
            </div>
          </div>
          {(status.model || status.tokSLabel || status.lastRunAtLabel) && (
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              {status.model ? (
                <div>
                  <dt className="inline font-medium text-foreground">Modell: </dt>
                  <dd className="inline">{status.model}</dd>
                </div>
              ) : null}
              {status.tokSLabel ? (
                <div>
                  <dt className="inline font-medium text-foreground">Siste hastighet: </dt>
                  <dd className="inline">{status.tokSLabel}</dd>
                </div>
              ) : null}
              {status.lastRunAtLabel ? (
                <div>
                  <dt className="inline font-medium text-foreground">Siste kjøring: </dt>
                  <dd className="inline">{status.lastRunAtLabel}</dd>
                </div>
              ) : null}
            </dl>
          )}
        </div>
      ) : null}
    </section>
  );
}
