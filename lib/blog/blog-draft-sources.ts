import {
  filterPublishableSources,
  parseTopicBriefSources,
  type ResearchTopicBriefSource,
} from '@/lib/admin/research/topic-brief-schema';
import { buildPublicSearchQuery } from '@/lib/sources/build-public-search-query';
import { filterBlockedSourceHits, hostnameFromUrl } from '@/lib/sources/blocklist';
import { canonicalSourceUrl, dedupeSourceHitsByUrl } from '@/lib/sources/normalize';
import { createDefaultPublicQueryDeps } from '@/lib/sources/public-query-loaders';
import { searchStortingetSources } from '@/lib/sources/stortinget-search';
import type { NormalizedSourceHit, PublicSearchScope } from '@/lib/sources/types';
import { isWebSearchEnabled, searchWebSources } from '@/lib/sources/web-search';
import { formatBlogDraftSourceLabel } from '@/lib/blog/blog-draft-source-label';

export type BlogDraftSourceChannel = 'stortinget' | 'admin_saved' | 'web';

export type BlogDraftSource = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: string | null;
  channel: BlogDraftSourceChannel;
  snippet: string;
};

export type BlogDraftCmsSource = {
  label: string;
  url: string;
};

const DEFAULT_TOTAL_LIMIT = 12;
const MIN_INDEPENDENT_DOMAINS = 2;

function domainKey(hit: { url: string; domain?: string }): string {
  const fromField = hit.domain?.trim().toLowerCase();
  if (fromField) return fromField;
  const host = hostnameFromUrl(hit.url);
  return host?.toLowerCase() ?? '';
}

function briefSourceToHit(source: ResearchTopicBriefSource): NormalizedSourceHit | null {
  const url = source.url?.trim();
  const title = source.title?.trim();
  if (!url || !title) return null;
  return {
    title,
    url,
    domain: domainKey({ url, domain: source.publisher ?? undefined }),
    snippet: '',
    sourceType: 'web',
  };
}

export function adminSavedSourcesFromBriefOutput(output: unknown): NormalizedSourceHit[] {
  if (!output || typeof output !== 'object') return [];
  const rawSection = (output as { sources?: { items?: unknown[]; note?: string } }).sources;
  const section = {
    items: rawSection?.items ?? [],
    note: rawSection?.note ?? '',
  };
  const publishable = filterPublishableSources(parseTopicBriefSources(section));
  const hits: NormalizedSourceHit[] = [];
  for (const row of publishable) {
    const hit = briefSourceToHit(row);
    if (hit) hits.push(hit);
  }
  return filterBlockedSourceHits(hits);
}

function hitToBlogDraftSource(
  hit: NormalizedSourceHit,
  channel: BlogDraftSourceChannel,
): BlogDraftSource {
  const publisher = hit.domain.trim() || hostnameFromUrl(hit.url) || 'Ukjent utgiver';
  return {
    id: canonicalSourceUrl(hit.url).toLowerCase(),
    title: hit.title.trim() || 'Kilde',
    publisher,
    url: hit.url.trim(),
    publishedAt: hit.publishedAt?.trim() || null,
    channel,
    snippet: hit.snippet.trim(),
  };
}

export type MergeBlogDraftSourcesInput = {
  stortinget: readonly NormalizedSourceHit[];
  adminSaved: readonly NormalizedSourceHit[];
  web: readonly NormalizedSourceHit[];
  totalLimit?: number;
  minIndependentDomains?: number;
};

/**
 * Dedupe by canonical URL, then prefer domain diversity (min two domains when possible).
 */
export function mergeBlogDraftSources(input: MergeBlogDraftSourcesInput): BlogDraftSource[] {
  const limit = input.totalLimit ?? DEFAULT_TOTAL_LIMIT;
  const minDomains = input.minIndependentDomains ?? MIN_INDEPENDENT_DOMAINS;

  const tagged: Array<{ hit: NormalizedSourceHit; channel: BlogDraftSourceChannel }> = [
    ...input.adminSaved.map((hit) => ({ hit, channel: 'admin_saved' as const })),
    ...input.stortinget.map((hit) => ({ hit, channel: 'stortinget' as const })),
    ...input.web.map((hit) => ({ hit, channel: 'web' as const })),
  ];

  const deduped = dedupeSourceHitsByUrl(tagged.map((row) => row.hit));
  const byUrl = new Map<string, BlogDraftSourceChannel>();
  for (const row of tagged) {
    const key = canonicalSourceUrl(row.hit.url).toLowerCase();
    if (!byUrl.has(key)) byUrl.set(key, row.channel);
  }

  const blocked = filterBlockedSourceHits(deduped);

  const pool = blocked.map((hit) =>
    hitToBlogDraftSource(hit, byUrl.get(canonicalSourceUrl(hit.url).toLowerCase()) ?? 'web'),
  );

  const selected: BlogDraftSource[] = [];
  const usedDomains = new Set<string>();
  const usedUrls = new Set<string>();

  const push = (source: BlogDraftSource) => {
    const urlKey = canonicalSourceUrl(source.url).toLowerCase();
    if (usedUrls.has(urlKey)) return;
    usedUrls.add(urlKey);
    selected.push(source);
  };

  for (const source of pool) {
    const domain = domainKey(source);
    if (!domain) continue;
    if (usedDomains.has(domain)) continue;
    usedDomains.add(domain);
    push(source);
    if (selected.length >= limit) return selected;
    if (usedDomains.size >= minDomains && selected.length >= minDomains) {
      break;
    }
  }

  for (const source of pool) {
    if (selected.length >= limit) break;
    push(source);
  }

  return selected.slice(0, limit);
}

export function blogDraftSourcesToCms(sources: readonly BlogDraftSource[]): BlogDraftCmsSource[] {
  return sources.map((source) => ({
    label: formatBlogDraftSourceLabel(source),
    url: source.url,
  }));
}

export type CollectBlogDraftSourcesResult = {
  sources: BlogDraftSource[];
  query: string | null;
  webSearchEnabled: boolean;
  webSearchAttempted: boolean;
  /** True når nettsøk var konfigurert, kjørt og returnerte feil (ikke «disabled»). */
  webSearchFailed: boolean;
};

export async function collectBlogDraftSources(
  scope: PublicSearchScope,
  options: {
    briefOutput?: unknown;
    deps?: Parameters<typeof buildPublicSearchQuery>[1];
    fetchImpl?: typeof fetch;
    stortingetLimit?: number;
    webLimit?: number;
  } = {},
): Promise<CollectBlogDraftSourcesResult> {
  const deps = options.deps ?? createDefaultPublicQueryDeps();
  const built = await buildPublicSearchQuery(scope, deps);
  const webEnabled = isWebSearchEnabled();
  const adminSaved = adminSavedSourcesFromBriefOutput(options.briefOutput);

  let stortinget: NormalizedSourceHit[] = [];
  let web: NormalizedSourceHit[] = [];
  let query: string | null = null;
  let webSearchFailed = false;

  if (built.ok) {
    query = built.query;
    const [stHits, webRes] = await Promise.all([
      searchStortingetSources(built.query, {
        issueId: built.issueId,
        limit: options.stortingetLimit ?? 8,
      }),
      webEnabled
        ? searchWebSources(built.query, {
            limit: options.webLimit ?? 6,
            fetchImpl: options.fetchImpl,
          })
        : Promise.resolve({ ok: false as const, error: '', disabled: true }),
    ]);
    stortinget = stHits;
    web = webRes.ok ? webRes.results : [];
    if (webEnabled) {
      webSearchFailed = !webRes.ok && !webRes.disabled;
    }
  }

  const sources = mergeBlogDraftSources({
    stortinget,
    adminSaved,
    web,
  });

  const webSearchAttempted = webEnabled && Boolean(built.ok);

  return {
    sources,
    query,
    webSearchEnabled: webEnabled,
    webSearchAttempted,
    webSearchFailed,
  };
}