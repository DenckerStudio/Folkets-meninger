import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isIssueStance,
  type IssueStance,
  type StanceHistoryItem,
  type StanceSignals,
} from '@/lib/stances/types';

export class StanceServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StanceServiceError';
  }
}

export async function setIssueStance(
  service: SupabaseClient,
  userId: string,
  issueId: string,
  stance: IssueStance,
  title?: string | null,
  summary?: string | null,
): Promise<IssueStance> {
  const { data, error } = await service.rpc('set_issue_stance', {
    p_user_id: userId,
    p_issue_id: issueId,
    p_stance: stance,
    p_title: title ?? null,
    p_summary: summary ?? null,
  });

  if (error) {
    throw new StanceServiceError(error.message);
  }

  if (data && typeof data === 'object' && isIssueStance((data as { stance?: unknown }).stance)) {
    return (data as { stance: IssueStance }).stance;
  }

  return stance;
}

export async function getUserStanceOnIssue(
  service: SupabaseClient,
  userId: string,
  issueId: string,
): Promise<IssueStance | null> {
  const { data, error } = await service.rpc('get_user_stance_on_issue', {
    p_user_id: userId,
    p_issue_id: issueId,
  });

  if (error) {
    throw new StanceServiceError(error.message);
  }

  if (!data || typeof data !== 'object') {
    return null;
  }

  const payload = data as { hasStance?: boolean; stance?: unknown };
  if (!payload.hasStance || !isIssueStance(payload.stance)) {
    return null;
  }

  return payload.stance;
}

export async function getUserStanceHistory(
  service: SupabaseClient,
  userId: string,
): Promise<StanceHistoryItem[]> {
  const { data, error } = await service.rpc('get_user_stance_history', {
    p_user_id: userId,
  });

  if (error) {
    throw new StanceServiceError(error.message);
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((row) => row && typeof row === 'object' && isIssueStance((row as StanceHistoryItem).stance))
    .map((row) => row as StanceHistoryItem);
}

export async function getUserStanceCount(
  service: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data, error } = await service.rpc('get_user_stance_count', {
    p_user_id: userId,
  });

  if (error) {
    throw new StanceServiceError(error.message);
  }

  return typeof data === 'number' ? data : 0;
}

export async function getUserStanceSignals(
  service: SupabaseClient,
  userId: string,
  limit = 6,
): Promise<StanceSignals> {
  const { data, error } = await service.rpc('get_user_stance_signals', {
    p_user_id: userId,
    p_limit: limit,
  });

  if (error) {
    throw new StanceServiceError(error.message);
  }

  if (!data || typeof data !== 'object') {
    return { categories: [], labels: [] };
  }

  const payload = data as { categories?: unknown; labels?: unknown };
  const normalize = (value: unknown) =>
    Array.isArray(value)
      ? value.filter(
          (row): row is { value: string; count: number } =>
            Boolean(row) &&
            typeof row === 'object' &&
            typeof (row as { value?: unknown }).value === 'string' &&
            typeof (row as { count?: unknown }).count === 'number',
        )
      : [];

  return {
    categories: normalize(payload.categories),
    labels: normalize(payload.labels),
  };
}
