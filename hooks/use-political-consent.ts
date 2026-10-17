'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PoliticalConsentState } from '@/lib/consent/political-consent';
import { hasPoliticalStorageConsent } from '@/lib/consent/political-consent';

export function usePoliticalConsent(enabled: boolean) {
  const [state, setState] = useState<PoliticalConsentState | null>(null);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await fetch('/api/user/political-consent', { credentials: 'same-origin', cache: 'no-store' });
      if (res.ok) {
        setState(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    loading,
    state,
    hasStorageConsent: state ? hasPoliticalStorageConsent(state) : false,
    refresh,
  };
}
