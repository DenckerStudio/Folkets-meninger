'use client';

import { useEffect } from 'react';
import type { PollEmbedTheme } from '@/lib/polls/embed';

/**
 * Forces an explicit embed theme by pinning the `dark` class on `<html>` and
 * re-applying it if the app's theme provider changes it. `auto` leaves the
 * system preference (or the stored preference) untouched.
 */
export function EmbedThemeController({ theme }: { theme: PollEmbedTheme }) {
  useEffect(() => {
    if (theme === 'auto') return;
    const root = document.documentElement;
    const apply = () => {
      if (theme === 'dark') root.classList.add('dark');
      else root.classList.remove('dark');
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [theme]);

  return null;
}
