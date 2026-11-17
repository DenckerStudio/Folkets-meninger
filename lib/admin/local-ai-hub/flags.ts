const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

export function isAdminLocalAiHubEnabled(): boolean {
  const raw = process.env.FEATURE_ADMIN_LOCAL_AI_HUB?.trim().toLowerCase();
  if (!raw) return false;
  return TRUTHY.has(raw);
}