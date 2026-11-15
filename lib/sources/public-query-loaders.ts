import type { PublicQueryDeps } from '@/lib/sources/build-public-search-query';
import { getResearchTopicById } from '@/lib/admin/research/topic-service';
import { getServiceSupabase } from '@/lib/supabase';

const DOC_KEYWORD_LIMIT = 6;

export function createDefaultPublicQueryDeps(): PublicQueryDeps {
  return {
    loadIssue: async (issueId: string) => {
      const supabase = getServiceSupabase();
      const { data } = await supabase
        .from('stortinget_issues')
        .select('id, title, henvisning')
        .eq('id', issueId)
        .maybeSingle();
      if (!data) return null;
      return {
        id: String(data.id),
        title: typeof data.title === 'string' ? data.title : null,
        henvisning: typeof data.henvisning === 'string' ? data.henvisning : null,
      };
    },
    loadTopic: async (topicId: string) => {
      const topic = await getResearchTopicById(topicId);
      if (!topic) return null;
      return {
        stortinget_issue_id: topic.stortinget_issue_id,
        output: topic.output,
      };
    },
    loadDocumentKeywords: async (issueId: string) => {
      const supabase = getServiceSupabase();
      const { data } = await supabase
        .from('document_chunks')
        .select('metadata')
        .eq('issue_id', issueId)
        .is('hearing_document_id', null)
        .limit(24);
      const titles: string[] = [];
      const seen = new Set<string>();
      for (const row of data ?? []) {
        const meta = row.metadata;
        if (!meta || typeof meta !== 'object') continue;
        const title = (meta as { document_title?: unknown }).document_title;
        if (typeof title !== 'string') continue;
        const trimmed = title.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        titles.push(trimmed);
        if (titles.length >= DOC_KEYWORD_LIMIT) break;
      }
      return titles;
    },
  };
}