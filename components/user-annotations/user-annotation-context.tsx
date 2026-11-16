'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { UserAnnotationFlagType } from '@/lib/user-annotations/flag-types';
import type {
  UserAnnotationCreatableTargetType,
  UserAnnotationPublic,
} from '@/lib/user-annotations/types';
import { annotationFetchQueryKey } from '@/lib/user-annotations/fetch-query';
import { scrollToAnnotationMark } from '@/lib/user-annotations/reveal-annotation';

export type UserAnnotationLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export type PendingSelection = {
  container_key: string;
  quote: string;
  start_offset: number;
  end_offset: number;
  anchor_prefix: string | null;
  anchor_suffix: string | null;
};

export type UserAnnotationToastState = {
  message: string;
  variant: 'success' | 'error';
  actionLabel?: string;
  onAction?: () => void;
};

type UserAnnotationContextValue = {
  enabled: boolean;
  targetType: UserAnnotationCreatableTargetType;
  targetId: string;
  fetchQueryKey: string;
  annotations: UserAnnotationPublic[];
  annotationsByContainer: Map<string, UserAnnotationPublic[]>;
  loadStatus: UserAnnotationLoadStatus;
  loadError: string | null;
  toast: UserAnnotationToastState | null;
  refresh: () => Promise<void>;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  draftSelection: PendingSelection | null;
  setDraftSelection: (value: PendingSelection | null) => void;
  pending: PendingSelection | null;
  setPending: (value: PendingSelection | null) => void;
  focusAnnotationId: string | null;
  setFocusAnnotationId: (id: string | null) => void;
  openSaveDialogFromDraft: () => void;
  savePending: (input: { note: string | null; flag_type: UserAnnotationFlagType }) => Promise<boolean>;
  updateAnnotation: (
    id: string,
    input: { note?: string | null; flag_type?: UserAnnotationFlagType },
  ) => Promise<boolean>;
  removeAnnotation: (id: string) => Promise<boolean>;
  revealAnnotation: (id: string) => Promise<void>;
  showToast: (toast: UserAnnotationToastState, autoHideMs?: number) => void;
  clearToast: () => void;
};

const UserAnnotationContext = createContext<UserAnnotationContextValue | null>(null);

export function useUserAnnotations(): UserAnnotationContextValue | null {
  return useContext(UserAnnotationContext);
}

export function UserAnnotationProvider({
  enabled,
  targetType,
  targetId,
  children,
}: {
  enabled: boolean;
  targetType: UserAnnotationCreatableTargetType;
  targetId: string;
  children: ReactNode;
}) {
  const fetchQueryKey = annotationFetchQueryKey(targetType, targetId);
  const [annotations, setAnnotations] = useState<UserAnnotationPublic[]>([]);
  const [loadStatus, setLoadStatus] = useState<UserAnnotationLoadStatus>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<UserAnnotationToastState | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [draftSelection, setDraftSelection] = useState<PendingSelection | null>(null);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [focusAnnotationId, setFocusAnnotationId] = useState<string | null>(null);

  const clearToast = useCallback(() => setToast(null), []);

  const showToast = useCallback((next: UserAnnotationToastState, autoHideMs = 4200) => {
    setToast(next);
    if (autoHideMs > 0) {
      window.setTimeout(() => {
        setToast((current) => (current === next ? null : current));
      }, autoHideMs);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoadStatus('loading');
    setLoadError(null);
    const params = new URLSearchParams({
      target_type: targetType,
      target_id: targetId,
    });
    try {
      const res = await fetch(`/api/user-annotations?${params.toString()}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const message =
          res.status === 401
            ? 'Du må være logget inn for å se notater.'
            : res.status === 403
              ? 'Kun admin har tilgang til research-markeringer.'
              : 'Kunne ikke hente notater.';
        setLoadError(message);
        setLoadStatus('error');
        return;
      }
      const json = (await res.json()) as { annotations?: UserAnnotationPublic[] };
      setAnnotations(json.annotations ?? []);
      setLoadStatus('ready');
    } catch {
      setLoadError('Kunne ikke hente notater. Sjekk nettverksforbindelsen.');
      setLoadStatus('error');
    }
  }, [enabled, targetId, targetType]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [enabled, fetchQueryKey, refresh]);

  const openSaveDialogFromDraft = useCallback(() => {
    if (!draftSelection) return;
    setPending(draftSelection);
    setDraftSelection(null);
  }, [draftSelection]);

  const restoreAnnotation = useCallback(
    async (row: UserAnnotationPublic) => {
      const res = await fetch('/api/user-annotations', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          container_key: row.container_key,
          quote: row.quote,
          note: row.note,
          flag_type: row.flag_type,
          start_offset: row.start_offset,
          end_offset: row.end_offset,
          anchor_prefix: row.anchor_prefix,
          anchor_suffix: row.anchor_suffix,
        }),
      });
      if (!res.ok) {
        showToast(
          { message: 'Kunne ikke gjenopprette markeringen. Prøv igjen.', variant: 'error' },
          5000,
        );
        return;
      }
      await refresh();
      showToast({ message: 'Markering gjenopprettet', variant: 'success' });
    },
    [refresh, showToast, targetId, targetType],
  );

  const savePending = useCallback(
    async ({ note, flag_type }: { note: string | null; flag_type: UserAnnotationFlagType }) => {
      if (!pending) return false;
      const res = await fetch('/api/user-annotations', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          container_key: pending.container_key,
          quote: pending.quote,
          note,
          flag_type,
          start_offset: pending.start_offset,
          end_offset: pending.end_offset,
          anchor_prefix: pending.anchor_prefix,
          anchor_suffix: pending.anchor_suffix,
        }),
      });
      if (!res.ok) return false;
      setPending(null);
      window.getSelection()?.removeAllRanges();
      await refresh();
      showToast({ message: 'Markering lagret', variant: 'success' });
      return true;
    },
    [pending, refresh, showToast, targetId, targetType],
  );

  const updateAnnotation = useCallback(
    async (
      id: string,
      input: { note?: string | null; flag_type?: UserAnnotationFlagType },
    ) => {
      const res = await fetch(`/api/user-annotations/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) return false;
      await refresh();
      return true;
    },
    [refresh],
  );

  const removeAnnotation = useCallback(
    async (id: string) => {
      const removed = annotations.find((row) => row.id === id);
      const res = await fetch(`/api/user-annotations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) return false;
      await refresh();
      if (removed) {
        showToast(
          {
            message: 'Markering slettet',
            variant: 'success',
            actionLabel: 'Angre',
            onAction: () => {
              clearToast();
              void restoreAnnotation(removed);
            },
          },
          8000,
        );
      }
      return true;
    },
    [annotations, clearToast, refresh, restoreAnnotation, showToast],
  );

  const revealAnnotation = useCallback(
    async (id: string) => {
      const row = annotations.find((item) => item.id === id);
      if (!row) return;
      setFocusAnnotationId(id);
      await scrollToAnnotationMark(id, row.container_key);
    },
    [annotations],
  );

  const annotationsByContainer = useMemo(() => {
    const map = new Map<string, UserAnnotationPublic[]>();
    for (const row of annotations) {
      const list = map.get(row.container_key) ?? [];
      list.push(row);
      map.set(row.container_key, list);
    }
    return map;
  }, [annotations]);

  const value = useMemo(
    () => ({
      enabled,
      targetType,
      targetId,
      fetchQueryKey,
      annotations,
      annotationsByContainer,
      loadStatus,
      loadError,
      toast,
      refresh,
      panelOpen,
      setPanelOpen,
      draftSelection,
      setDraftSelection,
      pending,
      setPending,
      focusAnnotationId,
      setFocusAnnotationId,
      openSaveDialogFromDraft,
      savePending,
      updateAnnotation,
      removeAnnotation,
      revealAnnotation,
      showToast,
      clearToast,
    }),
    [
      annotations,
      annotationsByContainer,
      clearToast,
      draftSelection,
      enabled,
      fetchQueryKey,
      focusAnnotationId,
      loadError,
      loadStatus,
      openSaveDialogFromDraft,
      panelOpen,
      pending,
      refresh,
      removeAnnotation,
      revealAnnotation,
      savePending,
      showToast,
      targetId,
      targetType,
      toast,
      updateAnnotation,
    ],
  );

  return <UserAnnotationContext.Provider value={value}>{children}</UserAnnotationContext.Provider>;
}