'use client';

import { useEffect } from 'react';
import { captureSelectionInRoot } from '@/lib/user-annotations/selection';
import { useUserAnnotations } from '@/components/user-annotations/user-annotation-context';

function findAnnotationContainer(node: Node | null): HTMLElement | null {
  if (!node) return null;
  const el = node instanceof HTMLElement ? node : node.parentElement;
  return el?.closest('[data-annotation-container]') ?? null;
}

export function UserAnnotationSelectionCapture() {
  const ctx = useUserAnnotations();
  const enabled = ctx?.enabled ?? false;
  const setDraftSelection = ctx?.setDraftSelection;

  useEffect(() => {
    if (!enabled || !setDraftSelection) return;

    const syncFromSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setDraftSelection(null);
        return;
      }
      const container = findAnnotationContainer(selection.anchorNode);
      if (!container) {
        setDraftSelection(null);
        return;
      }
      const containerKey = container.getAttribute('data-annotation-container');
      if (!containerKey) {
        setDraftSelection(null);
        return;
      }
      const captured = captureSelectionInRoot(container, selection);
      if (!captured) {
        setDraftSelection(null);
        return;
      }
      setDraftSelection({
        container_key: containerKey,
        ...captured,
      });
    };

    document.addEventListener('selectionchange', syncFromSelection);
    document.addEventListener('pointerup', syncFromSelection);
    return () => {
      document.removeEventListener('selectionchange', syncFromSelection);
      document.removeEventListener('pointerup', syncFromSelection);
    };
  }, [enabled, setDraftSelection]);

  return null;
}