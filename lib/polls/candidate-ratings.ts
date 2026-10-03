import type { PollGenerationMetadata } from '@/lib/polls/types';

export type CandidateRelevanceRating = {
  score: number;
  reason: string | null;
};

export type CandidateDateRating = {
  value: string | null;
  withinLastYear: boolean | null;
  cutoff: string | null;
  field: string | null;
};

export type CandidateDiscussionHit = {
  title: string | null;
  url: string | null;
};

export type CandidateDiscussionRating = {
  source: string | null;
  query: string | null;
  empty: boolean;
  hits: CandidateDiscussionHit[];
  modelSummary: string | null;
};

export type CandidateRatings = {
  relevance: CandidateRelevanceRating | null;
  date: CandidateDateRating | null;
  discussed: CandidateDiscussionRating | null;
  olderSources: unknown[];
  linkField: string | null;
  assessedAt: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text : null;
}

function parseRelevance(value: unknown): CandidateRelevanceRating | null {
  const row = asRecord(value);
  if (!row || typeof row.score !== 'number' || Number.isNaN(row.score)) return null;
  return {
    score: row.score,
    reason: asTrimmedString(row.reason),
  };
}

function parseDate(value: unknown): CandidateDateRating | null {
  const row = asRecord(value);
  if (!row) return null;
  const dateValue = asTrimmedString(row.value);
  const withinLastYear = typeof row.within_last_year === 'boolean' ? row.within_last_year : null;
  const cutoff = asTrimmedString(row.cutoff);
  const field = asTrimmedString(row.field);
  if (!dateValue && withinLastYear == null && !cutoff && !field) return null;
  return { value: dateValue, withinLastYear, cutoff, field };
}

function parseHits(value: unknown): CandidateDiscussionHit[] {
  if (!Array.isArray(value)) return [];
  const hits: CandidateDiscussionHit[] = [];
  for (const item of value) {
    const row = asRecord(item);
    if (!row) continue;
    const title = asTrimmedString(row.title) ?? asTrimmedString(row.name);
    const url = asTrimmedString(row.url) ?? asTrimmedString(row.link);
    if (!title && !url) continue;
    hits.push({ title, url });
  }
  return hits;
}

function parseDiscussed(value: unknown): CandidateDiscussionRating | null {
  const row = asRecord(value);
  if (!row) return null;
  const hits = parseHits(row.hits);
  return {
    source: asTrimmedString(row.source),
    query: asTrimmedString(row.query),
    empty: row.empty === true || hits.length === 0,
    hits,
    modelSummary: asTrimmedString(row.model_summary),
  };
}

export function parseCandidateRatings(
  metadata: PollGenerationMetadata | unknown,
): CandidateRatings | null {
  const root = asRecord(metadata);
  if (!root) return null;
  const raw = asRecord(root.candidate_ratings);
  if (!raw) return null;

  return {
    relevance: parseRelevance(raw.relevance_to_current_social_problems),
    date: parseDate(raw.date),
    discussed: parseDiscussed(raw.discussed),
    olderSources: Array.isArray(raw.older_sources) ? raw.older_sources : [],
    linkField: asTrimmedString(raw.link_field),
    assessedAt: asTrimmedString(raw.assessed_at),
  };
}

export function hasStoredCandidateRatings(ratings: CandidateRatings | null): boolean {
  if (!ratings) return false;
  return Boolean(
    ratings.relevance ||
      ratings.date ||
      ratings.discussed ||
      ratings.assessedAt ||
      ratings.linkField ||
      ratings.olderSources.length > 0,
  );
}
