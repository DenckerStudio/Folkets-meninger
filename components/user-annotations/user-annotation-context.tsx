'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { UserAnnotationPublic, UserAnnotationTargetType } from '@/lib/user-annotations/types';

type PendingSelection = {
  container_key: string;
  quote: string;
  start_offset: number;
  end_offset: number;
  anchor_prefix: string | null;
  anchor_suffix: string | null;
};

type UserAnnotationContextValue = {
  enabled: boolean;
  targetType: UserAnnotationTargetType;
  targetId: string;
  annotations: UserAnnotationPublic[];
  annotationsByContainer: Map<string, UserAnnotationPublic[]>;
  refresh: () => Promise<void>;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  pending: PendingSelection | null;
  setPending: (value: PendingSelection | null) => void;
  focusAnnotationId: string | null;
  setFocusAnnotationId: (id: string | null) => void;
  savePending: (note: string | null) => Promise<boolean>;
  updateNote: (id: string, note: string | null) => Promise<boolean>;
  removeAnnotation: (id: string) => Promise<boolean>;
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
  targetType: UserAnnotationTargetType;
  targetId: string;
  children: ReactNode;
}) {
  const [annotations, setAnnotations] = useState<UserAnnotationPublic[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [focusAnnotationId, setFocusAnnotationId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const params = new URLSearchParams({
      target_type: targetType,
      target_id: targetId,
    });
    const res = await fetch(`/api/user-annotations?${params.toString()}`, { credentials: 'same-origin' });
    if (!res.ok) return;
    const json = (await res.json()) as { annotations?: UserAnnotationPublic[] };
    setAnnotations(json.annotations ?? []);
  }, [enabled, targetId, targetType]);

  const savePending = useCallback(
    async (note: string | null) => {
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
          start_offset: pending.start_offset,
          end_offset: pending.end_offset,
          anchor_prefix: pending.anchor_prefix,
          anchor_suffix: pending.anchor_suffix,
        }),
      });
      if (!res.ok) return false;
      setPending(null);
      await refresh();
      return true;
    },
    [pending, refresh, targetId, targetType],
  );

  const updateNote = useCallback(async (id: string, note: string | null) => {
    const res = await fetch(`/api/user-annotations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    if (!res.ok) return false;
    await refresh();
    return true;
  }, [refresh]);

  const removeAnnotation = useCallback(async (id: string) => {
    const res = await fetch(`/api/user-annotations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    if (!res.ok) return false;
    await refresh();
    return true;
  }, [refresh]);

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
      annotations,
      annotationsByContainer,
      refresh,
      panelOpen,
      setPanelOpen,
      pending,
      setPending,
      focusAnnotationId,
      setFocusAnnotationId,
      savePending,
      updateNote,
      removeAnnotation,
    }),
    [
      annotations,
      annotationsByContainer,
      enabled,
      focusAnnotationId,
      panelOpen,
      pending,
      refresh,
      removeAnnotation,
      savePending,
      targetId,
      targetType,
      updateNote,
    ],
  );

  return <UserAnnotationContext.Provider value={value}>{children}</UserAnnotationContext.Provider>;
}