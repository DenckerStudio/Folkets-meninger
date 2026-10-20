import { getAnonSupabase, getServiceSupabase } from '@/lib/supabase';
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

export async function listPublicAppChangelogEntries(): Promise<ChangelogEntry[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('list_public_app_changelog_entries');
  if (error) throw error;
  return mapChangelog(data);
}

export async function createAppChangelogEntry(
  adminUserId: string,
  title: string,
  body: string,
  publish = false,
  idempotencyKey?: string | null,
): Promise<string> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('create_app_changelog_entry', {
    p_admin_user_id: adminUserId,
    p_title: title,
    p_body: body,
    p_publish: publish,
    p_idempotency_key: idempotencyKey ?? null,
  });
  if (error) throw error;
  return String(data);
}

export async function updateAppChangelogEntry(
  adminUserId: string,
  entryId: string,
  patch: { title?: string; body?: string; published?: boolean },
): Promise<string> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Endringslogg-administrasjon krever SUPABASE_SERVICE_ROLE_KEY på serveren.');
  }
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('update_app_changelog_entry', {
    p_admin_user_id: adminUserId,
    p_entry_id: entryId,
    p_title: patch.title ?? null,
    p_body: patch.body ?? null,
    p_publish: patch.published ?? null,
  });
  if (error) throw error;
  return String(data);
}

export async function reorderAppRoadmapItems(adminUserId: string, orderedIds: string[]): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Roadmap-administrasjon krever SUPABASE_SERVICE_ROLE_KEY på serveren.');
  }
  const service = getServiceSupabase();
  const { error } = await service.rpc('reorder_app_roadmap_items', {
    p_admin_user_id: adminUserId,
    p_ordered_ids: orderedIds,
  });
  if (error) throw error;
}

export async function deleteAppChangelogEntry(adminUserId: string, entryId: string): Promise<string> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('delete_app_changelog_entry', {
    p_admin_user_id: adminUserId,
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
  adminUserId: string,
  title: string,
  body: string,
  status: RoadmapStatus,
  sortOrder?: number,
): Promise<string> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Roadmap-administrasjon krever SUPABASE_SERVICE_ROLE_KEY på serveren.');
  }
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('create_app_roadmap_item', {
    p_admin_user_id: adminUserId,
    p_title: title,
    p_body: body,
    p_status: status,
    p_sort_order: sortOrder ?? null,
  });
  if (error) throw error;
  return String(data);
}

export async function updateAppRoadmapItem(
  adminUserId: string,
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
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Roadmap-administrasjon krever SUPABASE_SERVICE_ROLE_KEY på serveren.');
  }
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('update_app_roadmap_item', {
    p_admin_user_id: adminUserId,
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
  adminUserId: string,
  itemId: string,
  status: RoadmapStatus,
): Promise<string> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('set_app_roadmap_item_status', {
    p_admin_user_id: adminUserId,
    p_item_id: itemId,
    p_status: status,
  });
  if (error) throw error;
  return String(data);
}

export async function deleteAppRoadmapItem(adminUserId: string, itemId: string): Promise<string> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Roadmap-administrasjon krever SUPABASE_SERVICE_ROLE_KEY på serveren.');
  }
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('delete_app_roadmap_item', {
    p_admin_user_id: adminUserId,
    p_item_id: itemId,
  });
  if (error) throw error;
  return String(data);
}
