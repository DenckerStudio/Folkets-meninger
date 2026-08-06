'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { PREFERENCE_KEYS } from '@/lib/preferences/keys';
import {
  applyAppPreferencesToDocument,
  DEFAULT_APP_PREFERENCES,
  isAppPreferences,
  mergeAppPreferences,
  type AppPreferences,
} from '@/lib/preferences/app-preferences';
import { usePersistedState } from '@/hooks/use-persisted-state';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [rawPreferences] = usePersistedState(
    PREFERENCE_KEYS.app.preferences,
    DEFAULT_APP_PREFERENCES,
    isAppPreferences,
  );

  const preferences = mergeAppPreferences(rawPreferences);

  useEffect(() => {
    applyAppPreferencesToDocument(preferences, { pathname });

    const mediaTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const mediaMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const syncFromSystem = () => {
      applyAppPreferencesToDocument(preferences, { pathname });
    };

    mediaTheme.addEventListener('change', syncFromSystem);
    mediaMotion.addEventListener('change', syncFromSystem);

    return () => {
      mediaTheme.removeEventListener('change', syncFromSystem);
      mediaMotion.removeEventListener('change', syncFromSystem);
    };
  }, [preferences, pathname]);

  return children;
}

export function useAppPreferences(): [AppPreferences, (next: AppPreferences | ((prev: AppPreferences) => AppPreferences)) => void] {
  const pathname = usePathname();
  const [raw, setRaw] = usePersistedState(
    PREFERENCE_KEYS.app.preferences,
    DEFAULT_APP_PREFERENCES,
    isAppPreferences,
  );

  const preferences = mergeAppPreferences(raw);

  const setPreferences = (next: AppPreferences | ((prev: AppPreferences) => AppPreferences)) => {
    setRaw((prev) => {
      const current = mergeAppPreferences(prev);
      const resolved = typeof next === 'function' ? next(current) : next;
      applyAppPreferencesToDocument(resolved, { pathname });
      return resolved;
    });
  };

  return [preferences, setPreferences];
}

export function useSakTooltipsEnabled(): boolean {
  const [preferences] = useAppPreferences();
  return preferences.sakTooltips;
}
