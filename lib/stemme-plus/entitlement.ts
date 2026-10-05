import { getUser } from '@/lib/supabase-server';
import { getOwnSubscription } from '@/lib/stemme-plus/service';
import { isStemmePlusActive, type UserSubscriptionRow } from '@/lib/stemme-plus/tier';

export type StemmePlusEntitlement = {
  userId: string;
  active: boolean;
  subscription: UserSubscriptionRow;
};

export async function loadStemmePlusEntitlement(
  userId: string,
): Promise<StemmePlusEntitlement> {
  const subscription = await getOwnSubscription(userId);
  return {
    userId,
    active: isStemmePlusActive(subscription),
    subscription,
  };
}

export async function requireAuthedUser(): Promise<
  { ok: true; userId: string } | { ok: false; status: 401; error: string }
> {
  const user = await getUser();
  if (!user) {
    return { ok: false, status: 401, error: 'Du må være logget inn' };
  }
  return { ok: true, userId: user.id };
}

export async function requireStemmePlus(): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: string }
> {
  const auth = await requireAuthedUser();
  if (!auth.ok) return auth;

  const subscription = await getOwnSubscription(auth.userId);
  if (!isStemmePlusActive(subscription)) {
    return {
      ok: false,
      status: 403,
      error: 'Stemme+ kreves for denne funksjonen',
    };
  }

  return { ok: true, userId: auth.userId };
}
