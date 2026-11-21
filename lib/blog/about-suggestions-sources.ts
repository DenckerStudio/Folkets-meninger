import { listAppChangelogEntries, listAppRoadmapItems } from '@/lib/admin/app-future';
import { ABOUT_BLOG_CATEGORY_SLUG, listAboutBlogDrafts } from '@/lib/blog/about-draft';
import type {
  AboutChangelogSignal,
  AboutRoadmapSignal,
  AboutWrittenPiece,
} from '@/lib/blog/about-suggestions';
import type { AboutResearchSignal } from '@/lib/blog/about-suggestions-research';
import type { AboutWebHit } from '@/lib/blog/about-suggestions-web';
import { getSearxngBaseUrl, searchSearxng } from '@/lib/chat/searxng';
import { payloadFetchList, isCmsConfigured } from '@/lib/cms/payload-client';
import type { PayloadCategory, PayloadPost } from '@/lib/cms/types';
import { getServiceSupabase } from '@/lib/supabase';

const SKIPPED_CLUSTER_STATUSES = new Set(['rejected', 'blocked', 'not_action']);
const WEB_QUERIES = ['Folkets Meninger', 'folkets-meninger.no'] as const;

export type AboutSuggestionCmsState = 'ok' | 'unconfigured' | 'failed' | 'drafts_failed';

export type AboutSuggestionSourceBundle = {
  written: AboutWrittenPiece[];
  changelog: AboutChangelogSignal[];
  roadmap: AboutRoadmapSignal[];
  research: AboutResearchSignal[];
  webHits: AboutWebHit[];
  searxngConfigured: boolean;
  webError: string | null;
  cmsState: AboutSuggestionCmsState;
  notes: string[];
};

function titleFromSlug(slug: string): string {
  return slug
    .replace(/-[0-9a-f]{8}$/i, '')
    .replace(/-/g, ' ')
    .trim();
}

function isMissingRelation(error: { code?: string; message?: string } | null, table: string): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const message = error.message ?? '';
  return new RegExp(table, 'i').test(message) && /does not exist|schema cache|could not find/i.test(message);
}

async function loadPublishedPieces(): Promise<{
  pieces: AboutWrittenPiece[];
  state: 'ok' | 'unconfigured' | 'failed';
}> {
  if (!isCmsConfigured()) return { pieces: [], state: 'unconfigured' };
  try {
    const categories = await payloadFetchList<PayloadCategory>('categories', {
      limit: 1,
      depth: 0,
      'where[slug][equals]': ABOUT_BLOG_CATEGORY_SLUG,
    });
    const categoryId = categories.docs?.[0]?.id;
    if (!categoryId) return { pieces: [], state: 'ok' };
    const posts = await payloadFetchList<PayloadPost>('posts', {
      depth: 0,
      limit: 50,
      sort: '-publishedAt',
      'where[_status][equals]': 'published',
      'where[category][equals]': String(categoryId),
    });
    const pieces = (posts.docs ?? [])
      .map((post) => ({
        title: typeof post.title === 'string' ? post.title.trim() : '',
        kind: 'publisert' as const,
        at: post.updatedAt ?? post.publishedAt ?? null,
      }))
      .filter((piece) => piece.title.length > 0);
    return { pieces, state: 'ok' };
  } catch {
    console.error('[blog] kunne ikke lese publiserte om-innlegg');
    return { pieces: [], state: 'failed' };
  }
}

async function loadDraftPieces(): Promise<{ pieces: AboutWrittenPiece[]; failed: boolean }> {
  const listed = await listAboutBlogDrafts();
  if (listed.lookupFailed) return { pieces: [], failed: true };
  const pieces = listed.drafts
    .map((draft) => {
      const titled = draft.title?.trim();
      const title = titled || titleFromSlug(draft.slug);
      if (!title) return null;
      return {
        title,
        kind: draft.cmsStatus === 'published' ? ('publisert' as const) : ('utkast' as const),
        at: draft.updatedAt,
      };
    })
    .filter((piece): piece is AboutWrittenPiece => piece !== null);
  return { pieces, failed: false };
}

async function loadResearch(): Promise<{ signals: AboutResearchSignal[]; note: string | null }> {
  try {
    const supabase = getServiceSupabase();
    const clusters = await supabase
      .from('action_clusters')
      .select('id, action_name, topic, description_nb, target, status')
      .order('last_seen_at', { ascending: false })
      .limit(80);
    if (clusters.error) {
      if (isMissingRelation(clusters.error, 'action_clusters')) {
        return { signals: [], note: 'Research-klynger er ikke tilgjengelige i databasen.' };
      }
      console.error('[blog] kunne ikke lese action_clusters', clusters.error.code ?? 'ukjent');
      return { signals: [], note: 'Research-klynger kunne ikke leses.' };
    }

    const topics = await supabase
      .from('research_topics')
      .select('id, source_kind, cluster_id, title')
      .order('updated_at', { ascending: false })
      .limit(80);
    if (topics.error && !isMissingRelation(topics.error, 'research_topics')) {
      console.error('[blog] kunne ikke lese research_topics', topics.error.code ?? 'ukjent');
    }

    const byCluster = new Map<string, AboutResearchSignal>();
    for (const row of clusters.data ?? []) {
      const status = typeof row.status === 'string' ? row.status : '';
      if (SKIPPED_CLUSTER_STATUSES.has(status)) continue;
      const id = String(row.id);
      byCluster.set(id, {
        clusterId: id,
        topicId: null,
        sourceKind: 'cluster',
        actionName: typeof row.action_name === 'string' ? row.action_name : '',
        topic: typeof row.topic === 'string' ? row.topic : null,
        description: typeof row.description_nb === 'string' ? row.description_nb : '',
        target: typeof row.target === 'string' ? row.target : null,
      });
    }

    const signals = [...byCluster.values()];
    if (!topics.error) {
      for (const row of topics.data ?? []) {
        const topicId = String(row.id);
        const clusterId = row.cluster_id ? String(row.cluster_id) : null;
        if (clusterId && byCluster.has(clusterId)) {
          const existing = byCluster.get(clusterId);
          if (existing && !existing.topicId) existing.topicId = topicId;
          continue;
        }
        if (row.source_kind !== 'reddit') continue;
        signals.push({
          clusterId: null,
          topicId,
          sourceKind: 'reddit',
          actionName: typeof row.title === 'string' ? row.title : '',
          topic: null,
          description: '',
          target: null,
        });
      }
    }

    return { signals, note: null };
  } catch {
    console.error('[blog] research-oppslag for forslag feilet');
    return { signals: [], note: 'Research kunne ikke leses.' };
  }
}

async function loadWeb(): Promise<{ configured: boolean; hits: AboutWebHit[]; error: string | null }> {
  if (!getSearxngBaseUrl()) return { configured: false, hits: [], error: null };
  const hits: AboutWebHit[] = [];
  let error: string | null = null;
  for (const query of WEB_QUERIES) {
    const result = await searchSearxng(query, { limit: 8, timeoutMs: 8000 });
    if (!result.ok) {
      error = result.error;
      continue;
    }
    hits.push(...result.results);
  }
  return { configured: true, hits, error: hits.length > 0 ? null : error };
}

export async function loadAboutSuggestionSources(): Promise<AboutSuggestionSourceBundle> {
  const notes: string[] = [];
  const published = await loadPublishedPieces();
  const drafts =
    published.state === 'unconfigured' ? { pieces: [], failed: false } : await loadDraftPieces();

  let cmsState: AboutSuggestionCmsState = 'ok';
  if (published.state === 'unconfigured') {
    cmsState = 'unconfigured';
    notes.push('Bloggen er ikke koblet til fra denne serveren, så forslagene er ikke sjekket mot publiserte om-innlegg.');
  } else if (published.state === 'failed') {
    cmsState = 'failed';
    notes.push('Kunne ikke lese publiserte om-innlegg. Forslagene kan derfor gjenta noe som allerede er skrevet.');
  } else if (drafts.failed) {
    cmsState = 'drafts_failed';
    notes.push('Utkast merket about: kunne ikke leses. Publiserte om-innlegg er sjekket.');
  }

  let changelog: AboutChangelogSignal[] = [];
  try {
    const entries = await listAppChangelogEntries();
    changelog = entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      published: entry.publicationStatus === 'published',
    }));
  } catch {
    console.error('[blog] kunne ikke lese endringsloggen for forslag');
    notes.push('Endringsloggen kunne ikke leses.');
  }

  let roadmap: AboutRoadmapSignal[] = [];
  try {
    const items = await listAppRoadmapItems();
    roadmap = items.map((item) => ({ id: item.id, title: item.title, status: item.status }));
  } catch {
    console.error('[blog] kunne ikke lese veikartet for forslag');
    notes.push('Veikartet kunne ikke leses.');
  }

  const research = await loadResearch();
  if (research.note) notes.push(research.note);

  const web = await loadWeb();
  if (!web.configured) {
    notes.push('Nettsøk er ikke satt opp på serveren. Forslagene under bruker bare data vi allerede har.');
  } else if (web.error) {
    notes.push('Nettsøk svarte ikke. De andre forslagene er likevel med.');
  }

  return {
    written: [...drafts.pieces, ...published.pieces],
    changelog,
    roadmap,
    research: research.signals,
    webHits: web.hits,
    searxngConfigured: web.configured,
    webError: web.error,
    cmsState,
    notes,
  };
}
