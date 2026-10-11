'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildModelOptions } from '@/lib/byok/model-options';
import {
  providerModelsFromServer,
  SUGGESTED_MODELS,
  type LlmProvider,
} from '@/lib/byok/providers';

const CUSTOM = '__custom__';

export type ModelPickerProps = {
  provider: LlmProvider;
  model: string;
  onSwitched?: (model: string) => void;
  size?: 'sm' | 'md';
  className?: string;
  label?: string;
};

const controlClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-brand/30';

/**
 * Inline model switcher backed by `PATCH /api/byok`. Ollama lists the models of
 * the server already stored in the credential; other providers offer curated
 * presets plus free text. The API key is never touched.
 */
export function ModelPicker({
  provider,
  model,
  onSwitched,
  size = 'md',
  className,
  label = 'Modell',
}: ModelPickerProps) {
  const [value, setValue] = useState(model);
  const [serverModels, setServerModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState(model);

  useEffect(() => {
    setValue(model);
    setDraft(model);
  }, [model]);

  useEffect(() => {
    setError(null);
    setListError(null);
    setCustom(false);

    if (provider !== 'ollama') {
      setServerModels([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch('/api/byok/models', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const json = (await res.json().catch(() => ({}))) as {
          models?: unknown;
          error?: unknown;
        };
        if (controller.signal.aborted) return;
        setServerModels(
          Array.isArray(json.models)
            ? json.models.filter((item): item is string => typeof item === 'string')
            : [],
        );
        if (!res.ok) {
          setListError(typeof json.error === 'string' ? json.error : 'Kunne ikke hente modeller.');
        }
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        setServerModels([]);
        if (!(fetchError instanceof DOMException && fetchError.name === 'AbortError')) {
          setListError('Kunne ikke hente modeller fra Ollama.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [provider]);

  const switchTo = async (next: string) => {
    const trimmed = next.trim();
    if (!trimmed || trimmed === value || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/byok', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: trimmed }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'Kunne ikke bytte modell.');
      }
      setValue(trimmed);
      setDraft(trimmed);
      onSwitched?.(trimmed);
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : 'Kunne ikke bytte modell.');
    } finally {
      setBusy(false);
    }
  };

  const options = buildModelOptions({
    serverModels: provider === 'ollama' ? serverModels : null,
    presets: SUGGESTED_MODELS[provider],
    current: value,
  });
  const freeTextOnly = provider === 'openai_compatible';
  const fieldClass = cn(controlClass, size === 'sm' && 'py-1.5 text-xs');

  if (freeTextOnly || custom) {
    return (
      <div className={cn('space-y-1', className)}>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                setCustom(false);
                void switchTo(draft);
              }}
              placeholder="Modellnavn"
              aria-label={label}
              className={fieldClass}
            />
            <button
              type="button"
              onClick={() => {
                setCustom(false);
                void switchTo(draft);
              }}
              disabled={busy || !draft.trim() || draft.trim() === value}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              aria-label="Bruk modellen"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
            </button>
            {custom && !freeTextOnly ? (
              <button
                type="button"
                onClick={() => setCustom(false)}
                className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
              >
                Avbryt
              </button>
            ) : null}
          </div>
        </label>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <select
          value={value}
          disabled={busy || (provider === 'ollama' && loading)}
          onChange={(event) => {
            const next = event.target.value;
            if (next === CUSTOM) {
              setCustom(true);
              setDraft(value);
              return;
            }
            void switchTo(next);
          }}
          aria-label={label}
          className={fieldClass}
        >
          {provider === 'ollama' && loading ? (
            <option value={value}>Henter modeller …</option>
          ) : null}
          {options.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
          <option value={CUSTOM}>Egendefinert modell …</option>
        </select>
      </label>
      {listError ? (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <TriangleAlert className="size-3 shrink-0" aria-hidden />
          {listError}
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}