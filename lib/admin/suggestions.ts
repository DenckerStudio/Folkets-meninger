import { getServiceSupabase } from '@/lib/supabase';
import {
  isSuggestionStatus,
  type SuggestionRecord,
  type SuggestionStatus,
} from '@/lib/suggestions/constants';

function mapSuggestionRow(row: Record<string, unknown>): SuggestionRecord | null {
  if (typeof row.id !== 'string' || typeof row.user_id !== 'string' || typeof row.body !== 'string') {
    return null;
  }
  if (!isSuggestionStatus(row.status)) return null;

  return {
    id: row.id,
    userId: row.user_id,
    body: row.body,
    status: row.status,
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    handledAt: typeof row.handled_at === 'string' ? row.handled_at : null,
    handledBy: typeof row.handled_by === 'string' ? row.handled_by : null,
    authorName: typeof row.author_name === 'string' && row.author_name.trim() ? row.author_name : null,
  };
}

export async function listAppSuggestions(status?: SuggestionStatus | null): Promise<SuggestionRecord[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('list_app_suggestions', {
    p_status: status ?? null,
    p_limit: 100,
  });
  if (error) {
    throw error;
  }
  if (!Array.isArray(data)) return [];

  return data
    .map((row) => (row && typeof row === 'object' ? mapSuggestionRow(row as Record<string, unknown>) : null))
    .filter((row): row is SuggestionRecord => row != null);
}

export async function setAppSuggestionStatus(
  suggestionId: string,
  adminUserId: string,
  status: SuggestionStatus,
): Promise<string> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('set_app_suggestion_status', {
    p_suggestion_id: suggestionId,
    p_admin_user_id: adminUserId,
    p_status: status,
  });
  if (error) throw error;
  return String(data);
}