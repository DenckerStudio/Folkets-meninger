'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { writeLocalStorage } from '@/lib/preferences/local-storage';

type SetStateAction<T> = T | ((prev: T) => T);

const listeners = new Map<string, Set<() => void>>();

type SnapshotCacheEntry = {
  raw: string | null;
  value: unknown;
};

/** Per-key cache so getSnapshot returns a stable reference when localStorage is unchanged. */
const snapshotCache = new Map<string, SnapshotCacheEntry>();

function readRawFromStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseStoredValue<T>(
  raw: string | null,
  defaultValue: T,
  isValid?: (value: unknown) => value is T
): T {
  if (raw === null) return defaultValue;
  try {
    const stored = JSON.parse(raw) as unknown;
    if (isValid) {
      if (isValid(stored)) return stored;
      return defaultValue;
    }
    return stored as T;
  } catch {
    return defaultValue;
  }
}

function getCachedSnapshot<T>(
  key: string,
  defaultValue: T,
  isValid?: (value: unknown) => value is T
): T {
  const raw = readRawFromStorage(key);
  const cached = snapshotCache.get(key);
  if (cached && cached.raw === raw) {
    return cached.value as T;
  }
  const value = parseStoredValue(raw, defaultValue, isValid);
  snapshotCache.set(key, { raw, value });
  return value;
}

function setSnapshotCache(key: string, value: unknown): void {
  let raw: string | null;
  try {
    raw = JSON.stringify(value);
  } catch {
    raw = null;
  }
  snapshotCache.set(key, { raw, value });
}

function emitPreferenceChange(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

function subscribeToPreference(key: string, listener: () => void) {
  const set = listeners.get(key) ?? new Set();
  set.add(listener);
  listeners.set(key, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(key);
  };
}

export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  isValid?: (value: unknown) => value is T
): [T, (value: SetStateAction<T>) => void] {
  const getSnapshot = useCallback(
    () => getCachedSnapshot(key, defaultValue, isValid),
    [key, defaultValue, isValid]
  );

  const getServerSnapshot = useCallback(() => defaultValue, [defaultValue]);

  const value = useSyncExternalStore(
    (listener) => subscribeToPreference(key, listener),
    getSnapshot,
    getServerSnapshot
  );

  const setValue = useCallback(
    (next: SetStateAction<T>) => {
      const current = getCachedSnapshot(key, defaultValue, isValid);
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(current) : next;
      writeLocalStorage(key, resolved);
      setSnapshotCache(key, resolved);
      emitPreferenceChange(key);
    },
    [key, defaultValue, isValid]
  );

  return [value, setValue];
}
