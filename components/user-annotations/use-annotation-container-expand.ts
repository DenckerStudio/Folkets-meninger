'use client';

import { useEffect } from 'react';
import { USER_ANNOTATION_EXPAND_EVENT } from '@/lib/user-annotations/expand-container';

/** Utvider sammenfoldet tekst når brukeren ber om «Vis i tekst». */
export function useAnnotationContainerExpand(
  containerKey: string,
  expand: () => void,
): void {
  useEffect(() => {
    const onExpand = (event: Event) => {
      const detail = (event as CustomEvent<{ containerKey?: string }>).detail;
      if (detail?.containerKey !== containerKey) return;
      expand();
    };
    window.addEventListener(USER_ANNOTATION_EXPAND_EVENT, onExpand);
    return () => window.removeEventListener(USER_ANNOTATION_EXPAND_EVENT, onExpand);
  }, [containerKey, expand]);
}