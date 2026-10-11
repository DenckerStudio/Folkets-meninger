/**
 * Pure helper for the inline model picker. Merges server-provided models (Ollama
 * `/api/tags`) with curated presets and always keeps the currently selected model
 * so the `<select>` can show it even when it is not in either list.
 */
export function buildModelOptions(input: {
  serverModels?: readonly string[] | null;
  presets?: readonly string[] | null;
  current?: string | null;
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

  for (const model of input.serverModels ?? []) push(model);
  for (const model of input.presets ?? []) push(model);
  push(input.current ?? '');

  return options;
}
