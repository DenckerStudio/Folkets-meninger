import 'server-only';

import { getServiceSupabase } from '@/lib/supabase';
import type { MerknadChunk } from '@/lib/sak/arguments/extract-merknader';

type ChunkRow = {
  document_id: string | null;
  chunk_index: number | null;
  content: string | null;
  metadata: { section_title?: string; document_title?: string } | null;
};

export async function loadSakMerknadChunks(sakId: string): Promise<MerknadChunk[]> {
  const id = sakId.trim();
  if (!id) return [];

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('document_chunks')
      .select('document_id, chunk_index, content, metadata')
      .eq('issue_id', id)
      .order('chunk_index', { ascending: true })
      .limit(80);

    if (error) {
      console.error('[sak-arguments] document_chunks:', error.message);
      return [];
    }

    return ((data ?? []) as ChunkRow[]).map((row) => ({
      document_id: row.document_id,
      chunk_index: row.chunk_index,
      content: row.content,
      metadata: row.metadata,
    }));
  } catch {
    return [];
  }
}