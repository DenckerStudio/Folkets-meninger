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

function nearestMatchDistance(text: string, index: number, pattern: RegExp): number | null {
  let best: number | null = null;
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  for (const match of text.matchAll(re)) {
    const dist = Math.abs((match.index ?? 0) - index);
    if (best == null || dist < best) best = dist;
  }
  return best;
}

function detectPeriod(context: string): MoneyMention['period'] {
  const lower = context.toLowerCase();
  if (/per år|i året|årlig|\/år|pr\.?\s*år/.test(lower)) return 'year';
  if (/per måned|i måneden|månedlig|\/mnd|pr\.?\s*mnd/.test(lower)) return 'month';
  if (/engang|engangs|ettårig|dette året/.test(lower)) return 'one_time';
  return 'unknown';
}

function detectDirection(text: string, amountIndex: number): ImpactDirection {
  const up = nearestMatchDistance(
    text,
    amountIndex,
    /økt|øker|økes|øke|økning|høyere|mer i|tillegg|dyrt|dyrere|innføres|påslag|tilbakefør|tilbakebet|utbetales/gi,
  );
  const down = nearestMatchDistance(
    text,
    amountIndex,
    /redus|kutt|lavere|mindre i|fritak|fjern|lettelse|billigere|nedjust/gi,
  );
  const upDist = up != null && up < 140 ? up : null;
  const downDist = down != null && down < 140 ? down : null;
  if (upDist != null && downDist != null) {
    if (Math.abs(upDist - downDist) < 12) return 'mixed';
    return upDist < downDist ? 'increase' : 'decrease';
  }
  if (upDist != null) return 'increase';
  if (downDist != null) return 'decrease';
  return 'unknown';
}

function detectKind(text: string, amountIndex: number): ImpactAmountKind {
  const refund = nearestMatchDistance(text, amountIndex, /tilbakefør|tilbakebet|utbetaling|refusjon/gi);
  if (refund != null && refund < 160) return 'benefit';

  const benefit = nearestMatchDistance(
    text,
    amountIndex,
    /støtte|ytelse|stipend|trygd|tilskudd/gi,
  );
  const tax = nearestMatchDistance(text, amountIndex, /skatt|fradrag|formue/gi);
  const fee = nearestMatchDistance(text, amountIndex, /avgift|gebyr|bompenger|egenandel/gi);
  const ranked = [
    { kind: 'benefit' as const, dist: benefit },
    { kind: 'tax' as const, dist: tax },
    { kind: 'fee' as const, dist: fee },
  ]
    .filter((row) => row.dist != null && row.dist < 120)
    .sort((a, b) => (a.dist ?? 999) - (b.dist ?? 999));
  return ranked[0]?.kind ?? 'other';
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
      direction: detectDirection(text, match.index ?? 0),
      kind: detectKind(text, match.index ?? 0),
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
