import type { SakPickerOption } from './types';

const STOPWORDS = new Set([
  'alle',
  'andre',
  'at',
  'av',
  'bare',
  'bli',
  'blir',
  'da',
  'de',
  'deg',
  'den',
  'denne',
  'det',
  'dette',
  'disse',
  'du',
  'eller',
  'en',
  'enn',
  'er',
  'et',
  'etter',
  'for',
  'fra',
  'før',
  'ha',
  'hadde',
  'har',
  'hun',
  'hva',
  'hvor',
  'hvordan',
  'hvorfor',
  'i',
  'ikke',
  'inn',
  'jeg',
  'kan',
  'man',
  'med',
  'meg',
  'men',
  'min',
  'mot',
  'når',
  'og',
  'også',
  'om',
  'oss',
  'over',
  'på',
  'sak',
  'saken',
  'skal',
  'som',
  'stortinget',
  'til',
  'under',
  'ut',
  'ved',
  'vi',
  'vil',
  'være',
  'vært',
  'å',
]);

export function tokenizeOpinionQuery(text: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  const parts = text
    .toLowerCase()
    .normalize('NFC')
    .split(/[^\p{L}\p{N}]+/u);

  for (const part of parts) {
    if (part.length < 3 || STOPWORDS.has(part) || seen.has(part)) continue;
    seen.add(part);
    tokens.push(part);
  }

  return tokens;
}

function scoreSakOption(option: SakPickerOption, query: string, tokens: string[]): number {
  const title = option.title.toLowerCase();
  const category = (option.category ?? '').toLowerCase();
  const henvisning = (option.henvisning ?? '').toLowerCase();
  const haystack = `${title} ${category} ${henvisning}`;
  let score = 0;

  if (query) {
    if (option.id === query || option.id.endsWith(query)) score += 80;
    else if (option.id.includes(query)) score += 40;
    if (title.includes(query)) score += 28;
  }

  for (const token of tokens) {
    if (title.includes(token)) score += 10;
    if (category.includes(token)) score += 5;
    if (henvisning.includes(token)) score += 3;
    const word = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(token)}(?:$|[^\\p{L}\\p{N}])`, 'u');
    if (word.test(haystack)) score += 6;
  }

  return score;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function rankSakOptions(
  options: SakPickerOption[],
  context: string,
  limit = 8,
): SakPickerOption[] {
  const query = context.trim().toLowerCase();
  const tokens = tokenizeOpinionQuery(context);
  if (!query) return options.slice(0, limit);

  const ranked = options
    .map((option) => ({ option, score: scoreSakOption(option, query, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.option.title.localeCompare(b.option.title, 'nb'));

  if (ranked.length > 0) {
    return ranked.slice(0, limit).map((entry) => entry.option);
  }

  return options.slice(0, limit);
}
