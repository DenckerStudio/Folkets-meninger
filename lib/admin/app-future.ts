import { getServiceSupabase } from '@/lib/supabase';
import { mapChangelogRow, mapRoadmapRow } from '@/lib/appens-fremtid/map';
import type { ChangelogEntry, RoadmapItem, RoadmapStatus } from '@/lib/appens-fremtid/constants';

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

export async function listAppRoadmapItems(): Promise<RoadmapItem[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('list_app_roadmap_items');
  if (error) throw error;
  return mapRoadmap(data);
}

export async function createAppRoadmapItem(
  adminUserId: string,
  title: string,
  body: string,
  status: RoadmapStatus,
): Promise<string> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('create_app_roadmap_item', {
    p_admin_user_id: adminUserId,
    p_title: title,
    p_body: body,
    p_status: status,
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
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('delete_app_roadmap_item', {
    p_admin_user_id: adminUserId,
    p_item_id: itemId,
  });
  if (error) throw error;
  return String(data);
}
