import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readUserSubscription, type SubscriptionClient } from '@/lib/stemme-plus/service';

const entitlementSrc = readFileSync(new URL('./entitlement.ts', import.meta.url), 'utf8');
const serviceSrc = readFileSync(new URL('./service.ts', import.meta.url), 'utf8');
const statusSrc = readFileSync(new URL('../../app/api/stemme-plus/status/route.ts', import.meta.url), 'utf8');
const checkoutSrc = readFileSync(new URL('../../app/api/stemme-plus/checkout/route.ts', import.meta.url), 'utf8');
const portalSrc = readFileSync(new URL('../../app/api/stemme-plus/portal/route.ts', import.meta.url), 'utf8');
const profileSrc = readFileSync(new URL('../../app/api/user/profile/route.ts', import.meta.url), 'utf8');
const preferencesSrc = readFileSync(
  new URL('../../app/api/notifications/preferences/route.ts', import.meta.url),
  'utf8',
);
const chatSrc = readFileSync(new URL('../../app/api/chat/route.ts', import.meta.url), 'utf8');
const byokRouteSrc = readFileSync(new URL('../../app/api/byok/route.ts', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../../supabase/migrations/20261003210000_chat_session_byok_and_tier.sql', import.meta.url),
  'utf8',
);

assert.match(entitlementSrc, /getOwnSubscription/);
assert.doesNotMatch(entitlementSrc, /userHasStemmePlus|getUserSubscription|getServiceSupabase/);
assert.match(serviceSrc, /getOwnSubscription/);
assert.match(serviceSrc, /getServerSupabase/);
assert.match(serviceSrc, /subscription_tier, subscription_status, subscription_period_end/);
assert.match(serviceSrc, /stripe_customer_id/);
assert.doesNotMatch(statusSrc, /getServiceSupabase/);
assert.match(statusSrc, /readUserSubscription\(supabase, user\.id\)/);
assert.match(statusSrc, /has_stripe_customer: Boolean\(row\.stripe_customer_id\)/);
assert.doesNotMatch(statusSrc, /has_stripe_customer:\s*false/);
assert.match(statusSrc, /getByokMeta\(user\.id, supabase\)/);
assert.doesNotMatch(checkoutSrc, /getServiceSupabase/);
assert.match(checkoutSrc, /ownUserHasStemmePlus/);
assert.match(checkoutSrc, /readUserSubscription\(supabase, user\.id\)/);
assert.doesNotMatch(portalSrc, /getServiceSupabase/);
assert.match(portalSrc, /readUserSubscription\(supabase, user\.id\)/);
assert.match(profileSrc, /readUserSubscription\(supabase, user\.id\)/);
assert.match(profileSrc, /isStemmePlusActive\(subscription\)/);
assert.match(preferencesSrc, /getOwnSubscription/);
assert.doesNotMatch(preferencesSrc, /getServiceSupabase/);
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

function fakeSelectAwareClient(
  onSelect: (columns: string) => {
    data: Record<string, unknown> | null;
    error: { message: string } | null;
  },
): SubscriptionClient {
  return {
    from: () =>
      ({
        select: (columns: string) => ({
          eq: () => ({
            maybeSingle: async () => onSelect(columns),
          }),
        }),
      }) as ReturnType<SubscriptionClient['from']>,
  };
}

async function main() {
  const plus = await readUserSubscription(
    fakeSubscriptionClient({
      subscription_tier: 'stemme_plus',
      subscription_status: 'active',
      subscription_period_end: null,
      stripe_customer_id: 'cus_live_own',
    }),
    'user-1',
  );
  assert.equal(plus.userId, 'user-1');
  assert.equal(plus.subscription_tier, 'stemme_plus');
  assert.equal(plus.stripe_customer_id, 'cus_live_own');

  const denied = await readUserSubscription(
    fakeSubscriptionClient(null, { message: 'permission denied for column subscription_tier' }),
    'user-2',
  );
  assert.equal(denied.subscription_tier, 'free');
  assert.equal(denied.stripe_customer_id, null);

  const customerDenied = await readUserSubscription(
    fakeSelectAwareClient((columns) => {
      if (columns.includes('stripe_customer_id')) {
        return { data: null, error: { message: 'permission denied for column stripe_customer_id' } };
      }
      return {
        data: {
          subscription_tier: 'stemme_plus',
          subscription_status: 'active',
          subscription_period_end: null,
        },
        error: null,
      };
    }),
    'user-3',
  );
  assert.equal(customerDenied.subscription_tier, 'stemme_plus');
  assert.equal(customerDenied.stripe_customer_id, null);

  console.log('stemme-plus/session.test.ts: ok session-scoped entitlement + stripe customer');
}

void main();
