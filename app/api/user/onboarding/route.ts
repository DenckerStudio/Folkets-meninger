import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { userHasPublicIdentity } from '@/lib/identity/public-identity';
import {
  buildOnboardingUserMetadata,
  needsOnboarding,
  readOnboardingMetadata,
  type OnboardingMetadata,
} from '@/lib/onboarding';
import { getUserVerificationStatus } from '@/lib/user-verification';

export const dynamic = 'force-dynamic';

type OnboardingAction = 'complete' | 'tour_complete' | 'tour_reset';

function isOnboardingAction(value: unknown): value is OnboardingAction {
  return value === 'complete' || value === 'tour_complete' || value === 'tour_reset';
}

function metadataPatchForAction(action: OnboardingAction): Partial<OnboardingMetadata> {
  switch (action) {
    case 'complete':
      return { pending: false, completed: true, skipped: false, bankIdVerified: true };
    case 'tour_complete':
      return { tourCompleted: true };
    case 'tour_reset':
      return { tourCompleted: false };
    default: {
      const exhaustive: never = action;
      throw new Error(`Unknown onboarding action: ${exhaustive}`);
    }
  }
}

async function persistOnboardingState(
  userId: string,
  patch: Partial<OnboardingMetadata>,
): Promise<void> {
  const service = getServiceSupabase();
  const { error } = await service.rpc('set_user_onboarding_state', {
    p_user_id: userId,
    p_completed: patch.completed ?? null,
    p_skipped: patch.skipped ?? null,
    p_tour_completed: patch.tourCompleted ?? null,
  });

  if (error && !error.message?.includes('column') && error.code !== 'PGRST202') {
    console.warn('set_user_onboarding_state', error.message);
  }
}

export async function GET() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 });
  }

  const service = getServiceSupabase();
  let { data, error } = await service
    .from('users')
    .select('first_name, last_name, onboarding_completed_at, onboarding_skipped, onboarding_tour_completed_at')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    const fallback = await service
      .from('users')
      .select('first_name, last_name')
      .eq('id', user.id)
      .maybeSingle();
    data = fallback.data
      ? {
          ...fallback.data,
          onboarding_completed_at: null,
          onboarding_skipped: false,
          onboarding_tour_completed_at: null,
        }
      : null;
  }

  const metadata = readOnboardingMetadata(user);
  const hasPublicIdentity = userHasPublicIdentity(data);
  const dbCompleted = Boolean(
    (data as { onboarding_completed_at?: string | null } | null)?.onboarding_completed_at,
  );
  const dbSkipped = (data as { onboarding_skipped?: boolean | null } | null)?.onboarding_skipped === true;
  const dbTourCompleted = Boolean(
    (data as { onboarding_tour_completed_at?: string | null } | null)?.onboarding_tour_completed_at,
  );

  const merged: OnboardingMetadata = {
    pending: metadata.pending && !metadata.completed && !metadata.skipped && !dbCompleted,
    completed: metadata.completed || dbCompleted,
    skipped: metadata.skipped || dbSkipped,
    tourCompleted: metadata.tourCompleted || dbTourCompleted,
    bankIdVerified: metadata.bankIdVerified,
  };

  return NextResponse.json({
    first_name: data?.first_name ?? null,
    last_name: data?.last_name ?? null,
    has_public_identity: hasPublicIdentity,
    verification: getUserVerificationStatus(user),
    onboarding: merged,
    needs_onboarding: needsOnboarding({ metadata: merged, hasPublicIdentity }),
  });
}

export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (!isOnboardingAction(body.action)) {
    if (body.action === 'skip') {
      return NextResponse.json(
        { error: 'Navn, SMS og BankID er obligatorisk. Bare omvisningen kan hoppes over.' },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Ugyldig handling' }, { status: 400 });
  }

  await ensurePublicUser(user);

  if (body.action === 'complete') {
    const verification = getUserVerificationStatus(user);
    if (!verification.phoneVerified) {
      return NextResponse.json(
        { error: 'Telefonnummeret må bekreftes med SMS før onboarding kan fullføres.' },
        { status: 400 },
      );
    }
  }

  const patch = metadataPatchForAction(body.action);
  await persistOnboardingState(user.id, patch);

  const { error: metaError } = await supabase.auth.updateUser({
    data: buildOnboardingUserMetadata(patch),
  });
  if (metaError) {
    console.warn('onboarding metadata update', metaError.message);
  }

  return NextResponse.json({ success: true, action: body.action });
}
