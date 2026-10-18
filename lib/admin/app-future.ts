import { getAnonSupabase, getServiceSupabase } from '@/lib/supabase';
import { getServerSupabase } from '@/lib/supabase-server';
import { mapChangelogRow, mapRoadmapRow } from '@/lib/appens-fremtid/map';
import type { ChangelogEntry, RoadmapItem, RoadmapStatus } from '@/lib/appens-fremtid/constants';

const ROADMAP_COLUMNS = 'id, title, body, status, sort_order, created_at';

function mapChangelog(data: unknown): ChangelogEntry[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => (row && typeof row === 'object' ? mapChangelogRow(row as Record<string, unknown>) : null))
    .filter((row): row is ChangelogEntry => row != null);
}

function mapRoadmap(data: unknown): RoadmapItem[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => (row && typeof row === 'object' ? mapRoadmapRow(row as Record<string, unknown>) : null))
    .filter((row): row is RoadmapItem => row != null);
}

export async function listAppChangelogEntries(): Promise<ChangelogEntry[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('list_app_changelog_entries');
  if (error) throw error;
  return mapChangelog(data);
}

export async function createAppChangelogEntry(title: string, body: string): Promise<string> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('create_app_changelog_entry', {
    p_title: title,
    p_body: body,
  });
  if (error) throw error;
  return String(data);
}

export async function deleteAppChangelogEntry(entryId: string): Promise<string> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('delete_app_changelog_entry', {
    p_entry_id: entryId,
  });
  if (error) throw error;
  return String(data);
}

async function listRoadmapFromTable(
  client: ReturnType<typeof getAnonSupabase>,
): Promise<RoadmapItem[] | null> {
  const { data, error } = await client
    .from('app_roadmap_items')
    .select(ROADMAP_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return null;
  return mapRoadmap(data);
}

export async function listAppRoadmapItems(): Promise<RoadmapItem[]> {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const service = getServiceSupabase();
      const rpc = await service.rpc('list_app_roadmap_items');
      if (!rpc.error) return mapRoadmap(rpc.data);
      const fromTable = await listRoadmapFromTable(service);
      if (fromTable) return fromTable;
    } catch {
      // Dead or mismatched service-role host — fall back to anon/table read.
    }
  }

  const fromAnon = await listRoadmapFromTable(getAnonSupabase());
  if (fromAnon) return fromAnon;
  return [];
}

export async function createAppRoadmapItem(
  title: string,
  body: string,
  status: RoadmapStatus,
  sortOrder?: number,
): Promise<string> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('create_app_roadmap_item', {
    p_title: title,
    p_body: body,
    p_status: status,
    p_sort_order: sortOrder ?? null,
  });
  if (error) throw error;
  return String(data);
}

export async function updateAppRoadmapItem(
  itemId: string,
  patch: {
    title?: string;
    body?: string;
    status?: RoadmapStatus;
    sortOrder?: number;
  },
): Promise<string> {
  if (
    patch.title === undefined &&
    patch.body === undefined &&
    patch.status === undefined &&
    patch.sortOrder === undefined
  ) {
    throw new Error('Nothing to update');
  }
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('update_app_roadmap_item', {
    p_item_id: itemId,
    p_title: patch.title ?? null,
    p_body: patch.body ?? null,
    p_status: patch.status ?? null,
    p_sort_order: patch.sortOrder ?? null,
  });
  if (error) throw error;
  return String(data);
}

export async function setAppRoadmapItemStatus(
  itemId: string,
  status: RoadmapStatus,
): Promise<string> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('set_app_roadmap_item_status', {
    p_item_id: itemId,
    p_status: status,
  });
  if (error) throw error;
  return String(data);
}

export async function deleteAppRoadmapItem(itemId: string): Promise<string> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('delete_app_roadmap_item', {
    p_item_id: itemId,
  });
  if (error) throw error;
  return String(data);
}
