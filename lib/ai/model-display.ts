/**
 * User-facing model names should show the family only ("gemma4", "qwen3.5"),
 * never Ollama tags, quantization, parameter size or context length.
 * Model IDs in code/config stay untouched — this is display-only.
 */
const SIZE_PATTERN = /^e?\d+(\.\d+)?[bm]$/i;
const QUANT_PATTERN = /^q\d+(_[a-z0-9]+)+$/i;
const CONTEXT_PATTERN = /^\d+k$/i;
const DROP_TOKENS = new Set([
  'it',
  'instruct',
  'chat',
  'qat',
  'gguf',
  'fp16',
  'bf16',
  'f16',
  'q8_0',
  'awq',
  'gptq',
  'latest',
  'base',
  'json',
  'output',
]);

export function displayModelName(raw: string | null | undefined): string {
  if (!raw) return '';
  let name = raw.trim();
  name = name.replace(/\([^)]*\)/g, '').trim();
  const colonIndex = name.indexOf(':');
  if (colonIndex > 0) {
    name = name.slice(0, colonIndex);
  }
  const parts = name.split(/[-/\s]+/).filter(Boolean);
  const kept = parts.filter((part) => {
    if (SIZE_PATTERN.test(part)) return false;
    if (QUANT_PATTERN.test(part)) return false;
    if (CONTEXT_PATTERN.test(part)) return false;
    if (DROP_TOKENS.has(part.toLowerCase())) return false;
    return true;
  });
  return kept.length ? kept.join('-') : name;
}
