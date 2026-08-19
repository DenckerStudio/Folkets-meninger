import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { userHasPublicIdentity } from '@/lib/identity/public-identity';
import { parseActivityVisibility } from '@/lib/identity/activity-visibility';
import { getUserPointsProfile } from '@/lib/user-points-profile';
import {
  canAwardProfileCompletePoints,
  getUserVerificationStatus,
  PROFILE_BIO_MIN_LENGTH,
} from '@/lib/user-verification';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 });
  }

  const service = getServiceSupabase();
  let { data, error } = await service
    .from('users')
    .select('first_name, last_name, name, email, bio, party_preference, profile_is_public, show_party_preference, avatar_url, activity_visibility')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    const fallback = await service
      .from('users')
      .select('first_name, last_name, name, email')
      .eq('id', user.id)
      .maybeSingle();
    data = fallback.data
      ? {
          ...fallback.data,
          bio: '',
          party_preference: '',
          profile_is_public: false,
          show_party_preference: false,
          avatar_url: '',
          activity_visibility: 'private',
        }
      : null;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json({ error: 'Kunne ikke hente profil' }, { status: 500 });
  }

  const pointsProfile = await getUserPointsProfile(user.id);
  const verification = getUserVerificationStatus(user);

  return NextResponse.json({
    first_name: data?.first_name ?? null,
    last_name: data?.last_name ?? null,
    display_name: data?.name ?? null,
    email: data?.email ?? user.email,
    bio: data?.bio ?? '',
    party_preference: data?.party_preference ?? '',
    profile_is_public: data?.profile_is_public ?? false,
    show_party_preference: data?.show_party_preference ?? false,
    avatar_url: data?.avatar_url ?? '',
    points: pointsProfile.points,
    points_progress: pointsProfile.progress,
    recent_points: pointsProfile.recent,
    verification,
    profile_bio_min_length: PROFILE_BIO_MIN_LENGTH,
    profile_points_eligible: canAwardProfileCompletePoints({
      bio: data?.bio ?? '',
      profileIsPublic: data?.profile_is_public === true,
      verification,
    }),
    activity_visibility: parseActivityVisibility((data as { activity_visibility?: unknown } | null)?.activity_visibility),
    has_public_identity: userHasPublicIdentity(data),
  });
}

export async function PATCH(request: Request) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const hasNameFields = 'first_name' in body || 'last_name' in body;
  const firstName = typeof body.first_name === 'string' ? body.first_name.trim() : '';
  const lastName = typeof body.last_name === 'string' ? body.last_name.trim() : '';

  if (hasNameFields && (firstName.length < 2 || lastName.length < 2)) {
    return NextResponse.json(
      { error: 'Fornavn og etternavn må være minst 2 tegn' },
      { status: 400 },
    );
  }

  await ensurePublicUser(user);

  const service = getServiceSupabase();
  if (hasNameFields) {
    const { error } = await service.rpc('update_user_profile_names', {
      p_user_id: user.id,
      p_first_name: firstName,
      p_last_name: lastName,
    });

    if (error) {
      console.error('update_user_profile_names', error);
      return NextResponse.json({ error: 'Kunne ikke lagre navn' }, { status: 500 });
    }

    await supabase.auth.updateUser({
      data: {
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
      },
    });
  }

  const profilePatch: Record<string, string | boolean | null> = {};
  if ('bio' in body) profilePatch.bio = typeof body.bio === 'string' ? body.bio.trim().slice(0, 500) : '';
  if ('party_preference' in body) {
    profilePatch.party_preference =
      typeof body.party_preference === 'string' && body.party_preference.trim()
        ? body.party_preference.trim().slice(0, 80)
        : null;
  }
  if ('profile_is_public' in body) profilePatch.profile_is_public = body.profile_is_public === true;
  if ('show_party_preference' in body) profilePatch.show_party_preference = body.show_party_preference === true;
  if ('avatar_url' in body) profilePatch.avatar_url = typeof body.avatar_url === 'string' ? body.avatar_url.trim().slice(0, 500) : '';
  if ('activity_visibility' in body) {
    profilePatch.activity_visibility = parseActivityVisibility(body.activity_visibility);
  }

  let updatedProfile:
    | {
        bio: string | null;
        profile_is_public: boolean;
      }
    | null = null;

  if (Object.keys(profilePatch).length > 0) {
    const { data: updated, error } = await service
      .from('users')
      .update(profilePatch)
      .eq('id', user.id)
      .select('bio, profile_is_public')
      .maybeSingle();

    if (error) {
      if (error.message?.includes('column')) {
        return NextResponse.json(
          { error: 'Offentlig profil krever at siste Supabase-migrasjon er kjørt' },
          { status: 409 },
        );
      }
      console.error('update public profile fields', error);
      return NextResponse.json({ error: 'Kunne ikke lagre offentlig profil' }, { status: 500 });
    }

    updatedProfile = updated;
  }

  const verification = getUserVerificationStatus(user);
  const { data: currentProfile } = updatedProfile
    ? { data: updatedProfile }
    : await service
        .from('users')
        .select('bio, profile_is_public')
        .eq('id', user.id)
        .maybeSingle();

  const pointsProfile = await getUserPointsProfile(user.id);

  return NextResponse.json({
    success: true,
    first_name: hasNameFields ? firstName : undefined,
    last_name: hasNameFields ? lastName : undefined,
    display_name: hasNameFields ? `${firstName} ${lastName}` : undefined,
    has_public_identity: hasNameFields ? true : undefined,
    points: pointsProfile.points,
    points_progress: pointsProfile.progress,
    verification,
    profile_points_eligible: canAwardProfileCompletePoints({
      bio: currentProfile?.bio,
      profileIsPublic: currentProfile?.profile_is_public === true,
      verification,
    }),
  });
}
