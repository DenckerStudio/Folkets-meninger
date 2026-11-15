import {
  researchTopicBriefOutputSchema,
  type ResearchTopicBriefSource,
} from '@/lib/admin/research/topic-brief-schema';
import { getResearchTopicById } from '@/lib/admin/research/topic-service';
import { getServiceSupabase } from '@/lib/supabase';
import { hostnameFromUrl, isBlockedSourceUrl } from '@/lib/sources/blocklist';
import type { NormalizedSourceHit } from '@/lib/sources/types';

function toBriefSource(hit: NormalizedSourceHit): ResearchTopicBriefSource {
  return {
    id: crypto.randomUUID(),
    title: hit.title,
    url: hit.url,
    publisher: hit.domain || hostnameFromUrl(hit.url),
    grade: hit.sourceType === 'stortinget' ? 'A' : 'B',
  };
}

export type AppendTopicSourcesResult =
  | { ok: true; added: number; skipped: number }
  | { ok: false; code: 'not_found' | 'invalid_topic' | 'db_error'; message: string };

export async function appendSourcesToResearchTopic(
  topicId: string,
  selected: readonly NormalizedSourceHit[],
): Promise<AppendTopicSourcesResult> {
  const topic = await getResearchTopicById(topicId.trim());
  if (!topic) {
    return { ok: false, code: 'not_found', message: 'Fant ikke tema' };
  }
  if (topic.status !== 'done') {
    return {
      ok: false,
      code: 'invalid_topic',
      message: 'Kilder kan lagres når tema-brief er ferdig',
    };
  }

  const parsed = researchTopicBriefOutputSchema.safeParse(topic.output);
  if (!parsed.success) {
    return { ok: false, code: 'invalid_topic', message: 'Ugyldig tema-brief' };
  }

  const existing = parsed.data.sources.items ?? [];
  const existingUrls = new Set(
    existing
      .map((item) => {
        if (!item || typeof item !== 'object') return '';
        const url = (item as { url?: unknown }).url;
        return typeof url === 'string' ? url.trim().toLowerCase() : '';
      })
      .filter(Boolean),
  );

  let added = 0;
  let skipped = 0;
  const nextItems = [...existing];

  for (const hit of selected) {
    if (isBlockedSourceUrl(hit.url)) {
      skipped += 1;
      continue;
    }
    const key = hit.url.trim().toLowerCase();
    if (existingUrls.has(key)) {
      skipped += 1;
      continue;
    }
    existingUrls.add(key);
    nextItems.push(toBriefSource(hit));
    added += 1;
  }

  if (added === 0) {
    return { ok: true, added: 0, skipped };
  }

  const output = {
    ...parsed.data,
    sources: {
      ...parsed.data.sources,
      items: nextItems,
      note:
        nextItems.length > 0
          ? parsed.data.sources.note
          : parsed.data.sources.note || 'ingen funnet',
    },
  };

  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from('research_topics')
    .update({ output })
    .eq('id', topic.id);

  if (error) {
    return { ok: false, code: 'db_error', message: 'Kunne ikke lagre kilder' };
  }

  return { ok: true, added, skipped };
}