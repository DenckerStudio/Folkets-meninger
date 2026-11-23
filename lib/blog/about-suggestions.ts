import { roadmapStatusLabel, type RoadmapStatus } from '@/lib/appens-fremtid/constants';
import { findForbiddenAboutTerms, ABOUT_BLOG_TITLE_MIN } from '@/lib/blog/about-draft';
import { BLOG_TITLE_MAX } from '@/lib/blog/text-limits';
import {
  OM_FAQ,
  OM_FREE_FEATURES,
  OM_INTRO,
  OM_PROCESS_STEPS,
  OM_STEMME_PLUS_FEATURES,
  OM_WHY_POINTS,
} from '@/lib/landing/om-content';
import { STEMME_PLUS_NON_INFLUENCE_NOTE } from '@/lib/stemme-plus/constants';

export const ABOUT_SUGGESTION_SOURCES = [
  'dekning',
  'endringslogg',
  'veikart',
  'research',
  'nett',
  'staende',
] as const;

export type AboutSuggestionSource = (typeof ABOUT_SUGGESTION_SOURCES)[number];

export type AboutWrittenKind = 'utkast' | 'publisert';

export type AboutWrittenPiece = {
  title: string;
  kind: AboutWrittenKind;
  at: string | null;
};

export type AboutChangelogSignal = {
  id: string;
  title: string;
  published: boolean;
};

export type AboutRoadmapSignal = {
  id: string;
  title: string;
  status: RoadmapStatus;
};

export type AboutSuggestionRelated = {
  title: string;
  kind: AboutWrittenKind;
};

export type AboutSuggestionProvenance = {
  clusterId?: string;
  topicId?: string;
  changelogId?: string;
  roadmapId?: string;
  mentionUrl?: string;
  interestOnly?: boolean;
};

export type AboutSuggestion = {
  key: string;
  title: string;
  angle: string;
  reason: string;
  source: AboutSuggestionSource;
  related: AboutSuggestionRelated | null;
  provenance: AboutSuggestionProvenance;
  evergreen: boolean;
};

const COVERAGE_LIMIT = 8;
const CHANGELOG_LIMIT = 3;
const ROADMAP_LIMIT = 3;

const STOP_TOKENS = new Set([
  'alle',
  'allerede',
  'annen',
  'app',
  'appen',
  'bare',
  'blir',
  'denne',
  'dette',
  'eller',
  'folkets',
  'fra',
  'hva',
  'hvordan',
  'ikke',
  'innlegget',
  'med',
  'meninger',
  'når',
  'også',
  'punktet',
  'slik',
  'som',
  'tjenesten',
  'uten',
]);

export function aboutSuggestionSourceLabel(source: AboutSuggestionSource): string {
  switch (source) {
    case 'dekning':
      return 'Dekning';
    case 'endringslogg':
      return 'Endringslogg';
    case 'veikart':
      return 'Veikart';
    case 'research':
      return 'Research';
    case 'nett':
      return 'Nett';
    case 'staende':
      return 'Stående forslag';
    default: {
      const unhandled: never = source;
      return unhandled;
    }
  }
}

export function normalizeAboutSuggestionText(value: string): string {
  return value
    .toLocaleLowerCase('nb')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^\p{L}\p{N}+]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function significantAboutTokens(value: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of normalizeAboutSuggestionText(value).split(' ')) {
    if (token.length < 4 || STOP_TOKENS.has(token) || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

function clipSentence(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const word = cut.lastIndexOf(' ');
  const base = (word > 40 ? cut.slice(0, word) : cut).replace(/[\s,;:–-]+$/u, '');
  return `${base}…`;
}

function writable(title: string, angle: string, reason: string): boolean {
  const text = `${title}\n${angle}\n${reason}`;
  if (findForbiddenAboutTerms(text).length > 0) return false;
  if (title.trim().length < ABOUT_BLOG_TITLE_MIN || title.trim().length > BLOG_TITLE_MAX) return false;
  if (!reason.trim() || reason.includes('\n')) return false;
  return true;
}

function pieceMatchesPhrase(piece: AboutWrittenPiece, phrase: string): boolean {
  const hay = piece.title.toLocaleLowerCase('nb');
  return hay.includes(phrase.toLocaleLowerCase('nb'));
}

export function isAlreadyWritten(title: string, written: AboutWrittenPiece[]): boolean {
  const norm = normalizeAboutSuggestionText(title);
  if (!norm) return true;
  const mine = significantAboutTokens(title);
  return written.some((piece) => {
    const other = normalizeAboutSuggestionText(piece.title);
    if (!other) return false;
    if (other === norm) return true;
    if (mine.length < 2) return false;
    const theirs = new Set(significantAboutTokens(piece.title));
    return mine.every((token) => theirs.has(token));
  });
}

export function findLastSimilar(
  title: string,
  written: AboutWrittenPiece[],
): AboutWrittenPiece | null {
  const mine = significantAboutTokens(title);
  if (mine.length === 0) return null;
  let best: { piece: AboutWrittenPiece; score: number } | null = null;
  for (const piece of written) {
    if (isAlreadyWritten(title, [piece])) continue;
    const theirs = new Set(significantAboutTokens(piece.title));
    const score = mine.filter((token) => theirs.has(token)).length;
    if (score < 1) continue;
    if (!best || score > best.score) best = { piece, score };
  }
  return best?.piece ?? null;
}

function relatedFrom(title: string, written: AboutWrittenPiece[]): AboutSuggestionRelated | null {
  const piece = findLastSimilar(title, written);
  if (!piece) return null;
  const label = piece.title.trim();
  if (!label || findForbiddenAboutTerms(label).length > 0) return null;
  return { title: label, kind: piece.kind };
}

type CoverageSeed = {
  key: string;
  title: string;
  angle: string;
  reason: string;
  phrases: string[];
};

function coverageSeeds(): CoverageSeed[] {
  const faq: CoverageSeed[] = OM_FAQ.map((entry) => ({
    key: `dekning:faq:${entry.id}`,
    title: entry.question,
    angle: entry.answer,
    reason: `Ofte stilte spørsmål har «${entry.question}», og ingen om-tittel tar det opp.`,
    phrases: faqPhrases(entry.id),
  }));

  const gratis: CoverageSeed = {
    key: 'dekning:gratis',
    title: 'Hva som er gratis i Folkets Meninger',
    angle: `Gratis for alle: ${OM_FREE_FEATURES.join('; ')}.`,
    reason: 'Gratislisten på Om-siden er ikke dekket av en om-tittel.',
    phrases: ['gratis'],
  };

  const stemme: CoverageSeed = {
    key: 'dekning:stemme-pluss',
    title: 'Hva Stemme+ gir',
    angle: `Stemme+ gir: ${OM_STEMME_PLUS_FEATURES.join('; ')}. ${STEMME_PLUS_NON_INFLUENCE_NOTE}`,
    reason: 'Om-siden beskriver Stemme+, og ingen om-tittel tar det opp.',
    phrases: ['stemme+'],
  };

  const process: CoverageSeed[] = [
    { key: 'dekning:prosess:utforsk', title: 'Utforsk saker', phrases: ['utforsk'] },
    { key: 'dekning:prosess:stem', title: 'Stem og skriv', phrases: ['holdning'] },
    { key: 'dekning:prosess:horinger', title: 'Høringer', phrases: ['høring'] },
    { key: 'dekning:prosess:avstemninger', title: 'Avstemninger', phrases: ['avstemning'] },
    { key: 'dekning:prosess:valgomat', title: 'Valgomat 2.0', phrases: ['valgomat'] },
  ].flatMap((item) => {
    const step = OM_PROCESS_STEPS.find((entry) => entry.title === item.title);
    if (!step) return [];
    return [
      {
        key: item.key,
        title: step.title,
        angle: step.body,
        reason: `Prosesssteget «${step.title}» står på Om-siden og er ikke dekket av en om-tittel.`,
        phrases: item.phrases,
      },
    ];
  });

  return [...faq, gratis, stemme, ...process];
}

function faqPhrases(id: string): string[] {
  switch (id) {
    case 'representativitet':
      return ['representativ'];
    case 'noytralitet':
      return ['nøytral'];
    case 'hvem':
      return ['står bak', 'hvem står'];
    case 'finansiering':
      return ['finansier'];
    default:
      return [id];
  }
}

export function createAboutSuggestion(seed: {
  key: string;
  title: string;
  angle: string;
  reason: string;
  source: AboutSuggestionSource;
  written: AboutWrittenPiece[];
  provenance?: AboutSuggestionProvenance;
  evergreen?: boolean;
}): AboutSuggestion | null {
  const title = clipSentence(seed.title, BLOG_TITLE_MAX);
  const angle = clipSentence(seed.angle, 600);
  const reason = clipSentence(seed.reason, 280);
  if (!writable(title, angle, reason)) return null;
  if (isAlreadyWritten(title, seed.written)) return null;
  return {
    key: seed.key,
    title,
    angle,
    reason,
    source: seed.source,
    related: relatedFrom(title, seed.written),
    provenance: seed.provenance ?? {},
    evergreen: seed.evergreen === true,
  };
}

export function buildCoverageSuggestions(written: AboutWrittenPiece[]): AboutSuggestion[] {
  const suggestions: AboutSuggestion[] = [];
  for (const seed of coverageSeeds()) {
    if (written.some((piece) => seed.phrases.some((phrase) => pieceMatchesPhrase(piece, phrase)))) {
      continue;
    }
    const suggestion = createAboutSuggestion({ ...seed, source: 'dekning', written });
    if (!suggestion) continue;
    suggestions.push(suggestion);
    if (suggestions.length >= COVERAGE_LIMIT) break;
  }
  return suggestions;
}

export function buildChangelogSuggestions(
  entries: AboutChangelogSignal[],
  written: AboutWrittenPiece[],
): AboutSuggestion[] {
  const suggestions: AboutSuggestion[] = [];
  for (const entry of entries) {
    const title = entry.title.trim();
    if (!title) continue;
    const reason = entry.published
      ? `Endringsloggen har «${title}», og ingen om-tittel dekker punktet.`
      : `Endringsloggen har et upublisert punkt «${title}», så innlegget bør vente til punktet er klart.`;
    const suggestion = createAboutSuggestion({
      key: `endringslogg:${entry.id}`,
      title,
      angle:
        'Forklar punktet med det som allerede står om tjenesten. Ikke finn opp tall, datoer eller funksjoner.',
      reason,
      source: 'endringslogg',
      written,
      provenance: { changelogId: entry.id },
    });
    if (!suggestion) continue;
    suggestions.push(suggestion);
    if (suggestions.length >= CHANGELOG_LIMIT) break;
  }
  return suggestions;
}

export function buildRoadmapSuggestions(
  items: AboutRoadmapSignal[],
  written: AboutWrittenPiece[],
): AboutSuggestion[] {
  const suggestions: AboutSuggestion[] = [];
  for (const item of items) {
    const title = item.title.trim();
    if (!title) continue;
    const statusLabel = roadmapStatusLabel(item.status);
    const reason = `Veikartet har «${title}» med status ${statusLabel}.`;
    const angle =
      item.status === 'done'
        ? 'Punktet er merket ferdig i veikartet. Knytt det til det som allerede står om tjenesten, og ikke finn opp tall eller funksjoner.'
        : `Punktet er merket ${statusLabel} i veikartet. Beskriv bare dagens tjeneste, og ikke lov punktet som en ferdig funksjon.`;
    const suggestion = createAboutSuggestion({
      key: `veikart:${item.id}`,
      title,
      angle,
      reason,
      source: 'veikart',
      written,
      provenance: { roadmapId: item.id },
    });
    if (!suggestion) continue;
    suggestions.push(suggestion);
    if (suggestions.length >= ROADMAP_LIMIT) break;
  }
  return suggestions;
}

export function buildEvergreenAboutSuggestions(written: AboutWrittenPiece[] = []): AboutSuggestion[] {
  const why = OM_WHY_POINTS.map((point) => point.title).join(', ');
  const seeds: Array<Omit<Parameters<typeof createAboutSuggestion>[0], 'written' | 'source'>> = [
    {
      key: 'staende:hva-tjenesten-er',
      title: 'Derfor finnes Folkets Meninger',
      angle: OM_INTRO,
      reason: 'Stående forslag fra introteksten på Om-siden, ikke et nytt signal.',
      evergreen: true,
    },
    {
      key: 'staende:hvorfor',
      title: 'Hvorfor vi viser saker, meninger og vedtak',
      angle: why,
      reason: 'Stående forslag fra punktene om hvorfor tjenesten finnes.',
      evergreen: true,
    },
    {
      key: 'staende:prosess',
      title: 'Slik er løpet fra sak til avstemning',
      angle: OM_PROCESS_STEPS.map((step) => step.title).join(', '),
      reason: 'Stående forslag ut fra prosessstegene på Om-siden.',
      evergreen: true,
    },
  ];

  const suggestions: AboutSuggestion[] = [];
  for (const seed of seeds) {
    const suggestion = createAboutSuggestion({ ...seed, source: 'staende', written });
    if (suggestion) suggestions.push(suggestion);
  }
  return suggestions;
}

export function buildInternalAboutSuggestions(args: {
  written: AboutWrittenPiece[];
  changelog: AboutChangelogSignal[];
  roadmap: AboutRoadmapSignal[];
}): AboutSuggestion[] {
  const seen = new Set<string>();
  const suggestions: AboutSuggestion[] = [];
  for (const suggestion of [
    ...buildCoverageSuggestions(args.written),
    ...buildChangelogSuggestions(args.changelog, args.written),
    ...buildRoadmapSuggestions(args.roadmap, args.written),
  ]) {
    if (seen.has(suggestion.key)) continue;
    seen.add(suggestion.key);
    suggestions.push(suggestion);
  }
  return suggestions;
}

/** When nothing live is left, keep a few dismissible standing angles from Om-siden. */
export function withEvergreenFallback(
  live: AboutSuggestion[],
  written: AboutWrittenPiece[] = [],
): AboutSuggestion[] {
  if (live.length > 0) return live;
  return buildEvergreenAboutSuggestions(written);
}

export const ABOUT_SUGGESTION_SNOOZE_DAYS = 14;

export const ABOUT_SUGGESTION_STATUSES = ['open', 'used', 'dismissed', 'snoozed'] as const;
export type AboutSuggestionStatus = (typeof ABOUT_SUGGESTION_STATUSES)[number];

export type AboutSuggestionFeedback = {
  key: string;
  title: string;
  status: AboutSuggestionStatus;
  snoozeUntil: string | null;
  /** When status is `used`, false means the suggestion failed before a draft was saved. */
  usedHasDraft?: boolean;
};

export function suggestionUsageConsumesTitle(row: AboutSuggestionFeedback): boolean {
  if (row.status === 'dismissed') return true;
  if (row.status === 'used') return row.usedHasDraft !== false;
  return false;
}

export function suggestionFeedbackIsActive(row: AboutSuggestionFeedback, now: Date): boolean {
  if (row.status === 'dismissed') return true;
  if (row.status === 'used') return row.usedHasDraft !== false;
  if (row.status === 'snoozed') {
    if (!row.snoozeUntil) return true;
    const until = Date.parse(row.snoozeUntil);
    if (Number.isNaN(until)) return true;
    return until > now.getTime();
  }
  if (row.status === 'open') return false;
  const unhandled: never = row.status;
  return unhandled;
}

export function visibleAboutSuggestions(args: {
  live: AboutSuggestion[];
  written: AboutWrittenPiece[];
  feedback: AboutSuggestionFeedback[];
  now?: Date;
}): AboutSuggestion[] {
  const now = args.now ?? new Date();
  const blockedKeys = new Set(
    args.feedback.filter((row) => suggestionFeedbackIsActive(row, now)).map((row) => row.key),
  );
  const blockedTitles: AboutWrittenPiece[] = args.feedback
    .filter((row) => suggestionUsageConsumesTitle(row))
    .map((row) => ({ title: row.title, kind: 'publisert', at: null }));

  const keptLive = args.live.filter(
    (item) =>
      item.source !== 'staende' &&
      !blockedKeys.has(item.key) &&
      !isAlreadyWritten(item.title, blockedTitles),
  );
  return withEvergreenFallback(keptLive, [...args.written, ...blockedTitles]).filter(
    (item) => !blockedKeys.has(item.key) && !isAlreadyWritten(item.title, blockedTitles),
  );
}

export type AboutSuggestionWritePlan = {
  insert: AboutSuggestion[];
  update: AboutSuggestion[];
  deleteKeys: string[];
};

/** Refresh upserts open rows. Dismissed, used, and active snoozes stay as they are. */
export function planAboutSuggestionWrites(args: {
  existing: AboutSuggestionFeedback[];
  proposed: AboutSuggestion[];
  now: Date;
}): AboutSuggestionWritePlan {
  const blockedTitles: AboutWrittenPiece[] = args.existing
    .filter((row) => suggestionUsageConsumesTitle(row))
    .map((row) => ({ title: row.title, kind: 'publisert', at: null }));
  const existingByKey = new Map(args.existing.map((row) => [row.key, row]));
  const insert: AboutSuggestion[] = [];
  const update: AboutSuggestion[] = [];
  const proposedKeys = new Set<string>();

  for (const item of args.proposed) {
    proposedKeys.add(item.key);
    if (isAlreadyWritten(item.title, blockedTitles)) continue;
    const current = existingByKey.get(item.key);
    if (!current) {
      insert.push(item);
      continue;
    }
    if (current.status === 'dismissed') continue;
    if (current.status === 'used' && current.usedHasDraft !== false) continue;
    if (suggestionFeedbackIsActive(current, args.now)) continue;
    update.push(item);
  }

  const deleteKeys = args.existing
    .filter((row) => row.status === 'open' && !proposedKeys.has(row.key))
    .map((row) => row.key);

  return { insert, update, deleteKeys };
}
