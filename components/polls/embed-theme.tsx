'use client';

import { useEffect } from 'react';
import type { PollEmbedTheme } from '@/lib/polls/embed';

/**
 * Pins an explicit embed theme by setting `data-embed-theme` (and the `dark`
 * class) on `<html>` while the embed is mounted. `applyAppPreferencesToDocument`
 * honours the override, so the app theme provider applies it on its next pass
 * and no longer fights the embed. `auto` leaves the stored/system preference
 * untouched.
 */
export function EmbedThemeController({ theme }: { theme: PollEmbedTheme }) {
  useEffect(() => {
    if (theme === 'auto') return;
    const root = document.documentElement;
    root.dataset.embedTheme = theme;
    root.classList.toggle('dark', theme === 'dark');
    return () => {
      delete root.dataset.embedTheme;
    };
  }, [theme]);

  return null;
}
