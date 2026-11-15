import {
  researchTopicBriefOutputSchema,
  sectionIsEmpty,
} from '@/lib/admin/research/topic-brief-schema';
import type { PublicSearchScope } from '@/lib/sources/types';

const MAX_PUBLIC_QUERY_CHARS = 120;
const MAX_PHRASE_LEN = 48;

export type PublicQueryDeps = {
  loadIssue?: (issueId: string) => Promise<{
    id: string;
    title: string | null;
    henvisning: string | null;
  } | null>;
  loadTopic?: (topicId: string) => Promise<{
    stortinget_issue_id: string | null;
    output: unknown;
  } | null>;
  loadDocumentKeywords?: (issueId: string) => Promise<string[]>;
};

function clipPhrase(value: string, max = MAX_PHRASE_LEN): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function tokenizePublicPhrase(value: string): string[] {
  const cleaned = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];
  return cleaned.split(' ').filter((t) => t.length >= 3).slice(0, 8);
}

function phrasesFromBriefOutput(output: unknown): string[] {
  const parsed = researchTopicBriefOutputSchema.safeParse(output);
  if (!parsed.success) return [];
  const phrases: string[] = [];
  const topicTitle = parsed.data.topic_title?.trim();
  if (topicTitle) phrases.push(clipPhrase(topicTitle));

  const sections = [
    parsed.data.current_rules,
    parsed.data.party_proposals,
    parsed.data.media_coverage,
  ];
  for (const section of sections) {
    if (sectionIsEmpty(section)) continue;
    for (const item of section.items) {
      if (typeof item === 'string' && item.trim()) {
        for (const token of tokenizePublicPhrase(item)) {
          phrases.push(token);
        }
      } else if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>;
        for (const key of ['headline', 'proposal', 'party'] as const) {
          const val = row[key];
          if (typeof val === 'string' && val.trim()) {
            for (const token of tokenizePublicPhrase(val)) {
              phrases.push(token);
            }
          }
        }
      }
      if (phrases.length >= 12) break;
    }
    if (phrases.length >= 12) break;
  }
  return phrases;
}

export function composePublicSearchQuery(parts: readonly string[]): string | null {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }
  if (unique.length === 0) return null;
  return unique.join(' ').slice(0, MAX_PUBLIC_QUERY_CHARS);
}

const defaultDeps: Required<PublicQueryDeps> = {
  loadIssue: async () => null,
  loadTopic: async () => null,
  loadDocumentKeywords: async () => [],
};

export type BuildPublicSearchQueryResult =
  | { ok: true; query: string; issueId: string | null }
  | { ok: false; code: 'not_found' | 'no_public_terms'; message: string };

/**
 * Builds the only string ever sent to WEB_SEARCH_URL — from public Stortinget /
 * brief fields. Never uses research_topics.title, user notes, or client input.
 */
export async function buildPublicSearchQuery(
  scope: PublicSearchScope,
  deps: PublicQueryDeps = {},
): Promise<BuildPublicSearchQueryResult> {
  const { loadIssue, loadTopic, loadDocumentKeywords } = { ...defaultDeps, ...deps };
  const phrases: string[] = [];
  let issueId: string | null = null;

  if (scope.kind === 'issue') {
    issueId = scope.issueId.trim();
    const issue = await loadIssue(issueId);
    if (!issue) {
      return { ok: false, code: 'not_found', message: 'Fant ikke saken' };
    }
    if (issue.title?.trim()) phrases.push(clipPhrase(issue.title));
    if (issue.henvisning?.trim()) phrases.push(clipPhrase(issue.henvisning));
    const docKeys = await loadDocumentKeywords(issueId);
    phrases.push(...docKeys.map((k) => clipPhrase(k, 24)));
  } else {
    const topic = await loadTopic(scope.topicId.trim());
    if (!topic) {
      return { ok: false, code: 'not_found', message: 'Fant ikke tema' };
    }
    phrases.push(...phrasesFromBriefOutput(topic.output));
    issueId = topic.stortinget_issue_id?.trim() || null;
    if (issueId) {
      const issue = await loadIssue(issueId);
      if (issue?.title?.trim()) phrases.push(clipPhrase(issue.title));
      if (issue?.henvisning?.trim()) phrases.push(clipPhrase(issue.henvisning));
      const docKeys = await loadDocumentKeywords(issueId);
      phrases.push(...docKeys.map((k) => clipPhrase(k, 24)));
    }
  }

  const query = composePublicSearchQuery(phrases);
  if (!query) {
    return {
      ok: false,
      code: 'no_public_terms',
      message: 'Fant ikke offentlige søkeord for dette omfanget',
    };
  }

  return { ok: true, query, issueId };
}