import { getServiceSupabase } from '@/lib/supabase';
import { mapSuggestionRow } from '@/lib/appens-fremtid/map';
import {
  type SuggestionRecord,
  type SuggestionStatus,
} from '@/lib/appens-fremtid/constants';

function mapRows(data: unknown): SuggestionRecord[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => (row && typeof row === 'object' ? mapSuggestionRow(row as Record<string, unknown>) : null))
    .filter((row): row is SuggestionRecord => row != null);
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
  return mapRows(data);
}

export async function listVotingAppSuggestions(userId: string): Promise<SuggestionRecord[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('list_voting_app_suggestions', {
    p_user_id: userId,
  });
  if (error) {
    throw error;
  }
  return mapRows(data);
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

export async function setAppSuggestionVoting(
  suggestionId: string,
  adminUserId: string,
  votingOpen: boolean,
): Promise<string> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('set_app_suggestion_voting', {
    p_suggestion_id: suggestionId,
    p_admin_user_id: adminUserId,
    p_voting_open: votingOpen,
  });
  if (error) throw error;
  return String(data);
}

export async function castAppSuggestionVote(
  userId: string,
  suggestionId: string,
  vote: 'up' | 'down',
): Promise<{ upCount: number; downCount: number; myVote: 'up' | 'down' }> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('cast_app_suggestion_vote', {
    p_user_id: userId,
    p_suggestion_id: suggestionId,
    p_vote: vote,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    throw new Error('Vote failed');
  }
  const record = row as Record<string, unknown>;
  return {
    upCount: Number(record.up_count) || 0,
    downCount: Number(record.down_count) || 0,
    myVote: record.my_vote === 'down' ? 'down' : 'up',
  };
}
