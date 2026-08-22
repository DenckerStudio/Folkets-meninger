import type { ImpactAmountKind, ImpactDirection, MoneyMention } from './types';

function formatGrouped(num: number): string {
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const EXCERPT_WINDOW = 90;
const CLASSIFY_WINDOW = 48;

function windowAround(text: string, index: number, size: number): string {
  const start = Math.max(0, index - size);
  const end = Math.min(text.length, index + size);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function parseNorwegianAmount(raw: string): number | null {
  const compact = raw.replace(/\s/g, '').replace(',', '.');
  const value = Number.parseFloat(compact);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

function detectPeriod(context: string): MoneyMention['period'] {
  const lower = context.toLowerCase();
  if (/per år|i året|årlig|\/år|pr\.?\s*år/.test(lower)) return 'year';
  if (/per måned|i måneden|månedlig|\/mnd|pr\.?\s*mnd/.test(lower)) return 'month';
  if (/engang|engangs|ettårig|dette året/.test(lower)) return 'one_time';
  return 'unknown';
}

function detectDirection(context: string): ImpactDirection {
  const lower = context.toLowerCase();
  const up = /økt|øker|økes|øke|økning|høyere|mer i|tillegg|dyrt|dyrere|innføres|påslag/.test(lower);
  const down = /redus|kutt|lavere|mindre i|fritak|fjern|lettelse|billigere|nedjust/.test(lower);
  if (up && down) return 'mixed';
  if (up) return 'increase';
  if (down) return 'decrease';
  return 'unknown';
}

function detectKind(context: string): ImpactAmountKind {
  const lower = context.toLowerCase();
  if (/støtte|ytelse|stipend|refusjon|trygd|tilskudd/.test(lower)) return 'benefit';
  if (/skatt|fradrag|formue/.test(lower)) return 'tax';
  if (/avgift|gebyr|bompenger|egenandel/.test(lower)) return 'fee';
  return 'other';
}

const MONEY_RE =
  /(?:kr(?:oner)?\.?\s*)?(\d{1,3}(?:[ \u00a0]\d{3})+|\d{1,7})(?:[.,]\d+)?(?:\s*(?:kr(?:oner)?\.?|nok))?/gi;

export function extractMoneyMentions(text: string): MoneyMention[] {
  const mentions: MoneyMention[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(MONEY_RE)) {
    const raw = match[0];
    const digits = match[1];
    if (!digits) continue;
    if (!/kr|kroner|nok/i.test(raw)) continue;
    const amount = parseNorwegianAmount(digits);
    if (amount == null || amount < 50) continue;

    const excerpt = windowAround(text, match.index ?? 0, EXCERPT_WINDOW);
    const classify = windowAround(text, match.index ?? 0, CLASSIFY_WINDOW);
    const key = `${amount}:${excerpt.slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const period = detectPeriod(classify);
    const annual =
      period === 'month' ? amount * 12 : amount;

    mentions.push({
      amountKr: annual,
      raw,
      period,
      direction: detectDirection(classify),
      kind: detectKind(classify),
      excerpt,
    });
  }

  return mentions.slice(0, 6);
}

export function formatKr(amount: number): string {
  return `${formatGrouped(Math.abs(amount))} kr`;
}

export function amountVerb(direction: ImpactDirection, kind: ImpactAmountKind | null): string {
  const noun =
    kind === 'benefit' ? 'støtte' : kind === 'tax' ? 'skatt' : kind === 'fee' ? 'avgifter' : 'utgifter';

  switch (direction) {
    case 'increase':
      return kind === 'benefit' ? `mer i ${noun}` : `mer i ${noun}`;
    case 'decrease':
      return kind === 'benefit' ? `mindre i ${noun}` : `mindre i ${noun}`;
    case 'mixed':
      return `endringer i ${noun}`;
    case 'none':
      return `ingen vesentlig endring i ${noun}`;
    case 'unknown':
      return `en mulig effekt på ${noun}`;
    default: {
      const _exhaustive: never = direction;
      return _exhaustive;
    }
  }
}
