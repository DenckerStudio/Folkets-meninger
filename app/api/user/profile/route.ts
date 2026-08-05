import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { userHasForumIdentity } from '@/lib/forum/author-display';
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
    .select('first_name, last_name, name, email, bio, party_preference, profile_is_public, show_party_preference, avatar_url, fylke_code, fylke_verified, fylke_source')
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
          fylke_code: null,
          fylke_verified: false,
          fylke_source: null,
        }
      : null;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json({ error: 'Kunne ikke hente profil' }, { status: 500 });
  }

  const pointsProfile = await getUserPointsProfile(user.id);
  const verification = getUserVerificationStatus(user);
  const profileRow = data as {
    first_name?: string | null;
    last_name?: string | null;
    name?: string | null;
    email?: string | null;
    bio?: string | null;
    party_preference?: string | null;
    profile_is_public?: boolean;
    show_party_preference?: boolean;
    avatar_url?: string | null;
    fylke_code?: string | null;
    fylke_verified?: boolean | null;
    fylke_source?: string | null;
  } | null;

  return NextResponse.json({
    first_name: profileRow?.first_name ?? null,
    last_name: profileRow?.last_name ?? null,
    display_name: profileRow?.name ?? null,
    email: profileRow?.email ?? user.email,
    bio: profileRow?.bio ?? '',
    party_preference: profileRow?.party_preference ?? '',
    profile_is_public: profileRow?.profile_is_public ?? false,
    show_party_preference: profileRow?.show_party_preference ?? false,
    avatar_url: profileRow?.avatar_url ?? '',
    fylke_code: profileRow?.fylke_verified ? profileRow.fylke_code ?? null : null,
    fylke_verified: profileRow?.fylke_verified === true,
    fylke_source: profileRow?.fylke_verified ? profileRow.fylke_source ?? null : null,
    points: pointsProfile.points,
    points_progress: pointsProfile.progress,
    recent_points: pointsProfile.recent,
    verification,
    profile_bio_min_length: PROFILE_BIO_MIN_LENGTH,
    profile_points_eligible: canAwardProfileCompletePoints({
      bio: profileRow?.bio ?? '',
      profileIsPublic: profileRow?.profile_is_public === true,
      verification,
    }),
    has_forum_identity: userHasForumIdentity(data),
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
  // fylke_code is MinID/ID-porten verified only — clients cannot self-serve overwrite
  if ('fylke_code' in body) {
    return NextResponse.json(
      {
        error:
          'Fylke kan ikke endres manuelt. Det settes ved MinID/ID-porten-verifisering for å sikre fylkesstatistikken.',
      },
      { status: 403 },
    );
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

  if (
    canAwardProfileCompletePoints({
      bio: currentProfile?.bio,
      profileIsPublic: currentProfile?.profile_is_public === true,
      verification,
    })
  ) {
    await service.rpc('award_user_points', {
      p_user_id: user.id,
      p_delta: 15,
      p_reason: 'profile_complete',
      p_ref_type: 'profile',
      p_ref_key: 'profile_complete',
      p_ref_id: null,
    });
  }

  const pointsProfile = await getUserPointsProfile(user.id);

  return NextResponse.json({
    success: true,
    first_name: hasNameFields ? firstName : undefined,
    last_name: hasNameFields ? lastName : undefined,
    display_name: hasNameFields ? `${firstName} ${lastName}` : undefined,
    has_forum_identity: hasNameFields ? true : undefined,
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
