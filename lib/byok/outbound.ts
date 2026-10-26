import { isAdmin } from '@/lib/admin/gate';
import type { ByokOutboundAccess, DnsLookupFn } from '@/lib/byok/url-guard';

export async function byokOutboundForUser(
  userId: string,
  lookup?: DnsLookupFn,
): Promise<ByokOutboundAccess> {
  return {
    isAdmin: await isAdmin(userId),
    lookup,
  };
}
