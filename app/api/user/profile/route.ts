import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { userHasForumIdentity } from '@/lib/forum/author-display';
import { getUserPointSummary } from '@/lib/user-points';

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
    .select('first_name, last_name, name, email, bio, party_preference, profile_is_public, show_party_preference, show_points, avatar_url')
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
          show_points: true,
          avatar_url: '',
        }
      : null;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json({ error: 'Kunne ikke hente profil' }, { status: 500 });
  }

  const pointSummary = await getUserPointSummary(user.id);

  return NextResponse.json({
    first_name: data?.first_name ?? null,
    last_name: data?.last_name ?? null,
    display_name: data?.name ?? null,
    email: data?.email ?? user.email,
    bio: data?.bio ?? '',
    party_preference: data?.party_preference ?? '',
    profile_is_public: data?.profile_is_public ?? false,
    show_party_preference: data?.show_party_preference ?? false,
    show_points: data?.show_points ?? true,
    avatar_url: data?.avatar_url ?? '',
    points: pointSummary.points,
    recent_points: pointSummary.recent,
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
  if ('show_points' in body) profilePatch.show_points = body.show_points !== false;
  if ('avatar_url' in body) profilePatch.avatar_url = typeof body.avatar_url === 'string' ? body.avatar_url.trim().slice(0, 500) : '';

  if (Object.keys(profilePatch).length > 0) {
    const { error } = await service
      .from('users')
      .update(profilePatch)
      .eq('id', user.id);

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
  }

  return NextResponse.json({
    success: true,
    first_name: hasNameFields ? firstName : undefined,
    last_name: hasNameFields ? lastName : undefined,
    display_name: hasNameFields ? `${firstName} ${lastName}` : undefined,
    has_forum_identity: hasNameFields ? true : undefined,
  });
}
