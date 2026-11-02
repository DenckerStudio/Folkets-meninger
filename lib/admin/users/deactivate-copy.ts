import type { AdminUserRow } from '@/lib/admin/users/types';

function isActiveStripeSubscriptionStatus(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing';
}

export function formatDeactivateConfirmTitle(count: number): string {
  if (count <= 1) return 'Deaktivere brukeren?';
  return `Deaktivere ${count} brukere?`;
}

const DEACTIVATE_BODY =
  'Profilnavn, bio og bilde slettes permanent. Innlogging kan åpnes igjen senere, men profilen gjenopprettes ikke.';

export function formatDeactivateConfirmDescription(count: number): string {
  if (count <= 1) return DEACTIVATE_BODY;
  return DEACTIVATE_BODY;
}

export function formatDeactivateTargetNames(users: AdminUserRow[], maxNames = 3): string | null {
  if (users.length === 0) return null;
  const names = users.map((u) => {
    const fromProfile = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    return u.displayName?.trim() || fromProfile || u.email || 'Ukjent bruker';
  });
  if (names.length <= maxNames) {
    return names.join(', ');
  }
  const shown = names.slice(0, maxNames).join(', ');
  const rest = names.length - maxNames;
  return `${shown} og ${rest} til`;
}

export function countUsersWithActiveStripeSubscription(users: AdminUserRow[]): number {
  return users.filter((u) => isActiveStripeSubscriptionStatus(u.subscriptionStatus)).length;
}

export function formatDeactivateStripeWarning(stripeCount: number): string | null {
  if (stripeCount <= 0) return null;
  if (stripeCount === 1) {
    return 'Minst én valgt bruker har aktivt Stemme+-abonnement i Stripe og kan ikke deaktiveres før abonnementet avsluttes.';
  }
  return `${stripeCount} valgte brukere har aktivt Stemme+-abonnement i Stripe og kan ikke deaktiveres før abonnementet avsluttes.`;
}
