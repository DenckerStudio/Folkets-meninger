import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readUserSubscription, type SubscriptionClient } from '@/lib/stemme-plus/service';

const entitlementSrc = readFileSync(new URL('./entitlement.ts', import.meta.url), 'utf8');
const serviceSrc = readFileSync(new URL('./service.ts', import.meta.url), 'utf8');
const statusSrc = readFileSync(new URL('../../app/api/stemme-plus/status/route.ts', import.meta.url), 'utf8');
const chatSrc = readFileSync(new URL('../../app/api/chat/route.ts', import.meta.url), 'utf8');
const byokRouteSrc = readFileSync(new URL('../../app/api/byok/route.ts', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../../supabase/migrations/20261003200000_chat_session_byok_and_tier.sql', import.meta.url),
  'utf8',
);

assert.match(entitlementSrc, /getOwnSubscription/);
assert.doesNotMatch(entitlementSrc, /userHasStemmePlus|getUserSubscription|getServiceSupabase/);
assert.match(serviceSrc, /getOwnSubscription/);
assert.match(serviceSrc, /getServerSupabase/);
assert.match(serviceSrc, /subscription_tier, subscription_status, subscription_period_end/);
assert.doesNotMatch(statusSrc, /getServiceSupabase/);
assert.match(statusSrc, /readUserSubscription\(supabase, user\.id\)/);
assert.match(statusSrc, /getByokMeta\(user\.id, supabase\)/);
assert.doesNotMatch(chatSrc, /getServiceSupabase/);
assert.doesNotMatch(byokRouteSrc, /getServiceSupabase/);
assert.match(migration, /GRANT SELECT \(subscription_tier, subscription_status, subscription_period_end\)/);
assert.match(migration, /user_llm_credentials_select_own/);
assert.match(migration, /auth\.uid\(\)/);
assert.doesNotMatch(migration, /embedding|stripe_customer_id|stripe_subscription_id/);

function fakeSubscriptionClient(
  row: Record<string, unknown> | null,
  error: { message: string } | null = null,
): SubscriptionClient {
  return {
    from: () =>
      ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: row, error }),
          }),
        }),
      }) as ReturnType<SubscriptionClient['from']>,
  };
}

const plus = await readUserSubscription(
  fakeSubscriptionClient({
    subscription_tier: 'stemme_plus',
    subscription_status: 'active',
    subscription_period_end: null,
  }),
  'user-1',
);
assert.equal(plus.userId, 'user-1');
assert.equal(plus.subscription_tier, 'stemme_plus');

const denied = await readUserSubscription(
  fakeSubscriptionClient(null, { message: 'permission denied for column subscription_tier' }),
  'user-2',
);
assert.equal(denied.subscription_tier, 'free');

console.log('stemme-plus/session.test.ts: ok session-scoped entitlement');
