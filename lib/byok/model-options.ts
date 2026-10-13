/**
 * Pure helpers for the inline model picker. Merges server-provided models (Ollama
 * `/api/tags`) with curated presets and always keeps the currently selected model
 * so the `<select>` can show it even when it is not in either list.
 */
import { RECOMMENDED_OLLAMA_MODEL } from '@/lib/byok/providers';

export function buildModelOptions(input: {
  serverModels?: readonly string[] | null;
  presets?: readonly string[] | null;
  current?: string | null;
  /** Model to surface first (Ollama's chat-tuned default). */
  recommended?: string | null;
}): string[] {
  const seen = new Set<string>();
  const options: string[] = [];

  const push = (value: unknown) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    options.push(trimmed);
  };

  const recommended = input.recommended?.trim();
  if (recommended) push(recommended);
  for (const model of input.serverModels ?? []) push(model);
  for (const model of input.presets ?? []) push(model);
  push(input.current ?? '');

  return options;
}

/** Display label for a model option — marks the recommended Ollama model. */
export function modelOptionLabel(model: string): string {
  return model === RECOMMENDED_OLLAMA_MODEL ? `${model} (anbefalt)` : model;
}
