'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

/** Resolved Stemme+ chat entitlement for the signed-in session (same source as `/api/stemme-plus/status`). */
export type StemmePlusActiveState = 'pending' | 'inactive' | 'active';

export function useStemmePlusActive(): StemmePlusActiveState {
  const [state, setState] = useState<StemmePlusActiveState>('pending');
  const { user, loading } = useAuth();

  useEffect(() => {
    // Avoid the status call entirely while signed out — it only ever returns 401.
    if (loading || !user) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    void fetch('/api/stemme-plus/status', { cache: 'no-store', signal: controller.signal })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          setState('inactive');
          return;
        }
        const json = (await res.json()) as { tier?: string };
        if (!cancelled) {
          setState(json.tier === 'stemme_plus' ? 'active' : 'inactive');
        }
      })
      .catch(() => {
        if (!cancelled) setState('inactive');
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [user, loading]);

  if (loading) return 'pending';
  if (!user) return 'inactive';
  return state;
}
