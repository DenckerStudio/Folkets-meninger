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

export async function createAppChangelogEntry(
  adminUserId: string,
  title: string,
  body: string,
): Promise<string> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('create_app_changelog_entry', {
    p_admin_user_id: adminUserId,
    p_title: title,
    p_body: body,
  });
  if (error) throw error;
  return String(data);
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
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const service = getServiceSupabase();
      const { data, error } = await service.rpc('create_app_roadmap_item', {
        p_admin_user_id: adminUserId,
        p_title: title,
        p_body: body,
        p_status: status,
      });
      if (!error && data) {
        const id = String(data);
        if (sortOrder !== undefined) await updateAppRoadmapItem(id, { sortOrder });
        return id;
      }
    } catch {
      // Fall through to the signed-in admin client.
    }
  }

  const client = await getServerSupabase();
  const { data, error } = await client
    .from('app_roadmap_items')
    .insert({
      title,
      body,
      status,
      sort_order: sortOrder ?? 0,
      created_by: adminUserId,
    })
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('Could not create roadmap item');
  return String(data.id);
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
  const next: Record<string, string | number> = {};
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.body !== undefined) next.body = patch.body;
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.sortOrder !== undefined) next.sort_order = patch.sortOrder;
  if (Object.keys(next).length === 0) {
    throw new Error('Nothing to update');
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const service = getServiceSupabase();
      const { data, error } = await service
        .from('app_roadmap_items')
        .update(next)
        .eq('id', itemId)
        .select('id')
        .maybeSingle();
      if (!error && data?.id) return String(data.id);
    } catch {
      // Fall through to the signed-in admin client.
    }
  }

  const client = await getServerSupabase();
  const { data, error } = await client
    .from('app_roadmap_items')
    .update(next)
    .eq('id', itemId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('Roadmap item not found');
  return String(data.id);
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
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const service = getServiceSupabase();
      const { data, error } = await service.rpc('delete_app_roadmap_item', {
        p_admin_user_id: adminUserId,
        p_item_id: itemId,
      });
      if (!error && data) return String(data);
    } catch {
      // Fall through to the signed-in admin client.
    }
  }

  const client = await getServerSupabase();
  const { data, error } = await client
    .from('app_roadmap_items')
    .delete()
    .eq('id', itemId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('Roadmap item not found');
  return String(data.id);
}
