import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { userHasForumIdentity } from '@/lib/forum/author-display';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 });
  }

  const service = getServiceSupabase();
  const { data, error } = await service
    .from('users')
    .select('first_name, last_name, name, email')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Kunne ikke hente profil' }, { status: 500 });
  }

  return NextResponse.json({
    first_name: data?.first_name ?? null,
    last_name: data?.last_name ?? null,
    display_name: data?.name ?? null,
    email: data?.email ?? user.email,
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
  const firstName = typeof body.first_name === 'string' ? body.first_name.trim() : '';
  const lastName = typeof body.last_name === 'string' ? body.last_name.trim() : '';

  if (firstName.length < 2 || lastName.length < 2) {
    return NextResponse.json(
      { error: 'Fornavn og etternavn må være minst 2 tegn' },
      { status: 400 },
    );
  }

  await ensurePublicUser(user);

  const service = getServiceSupabase();
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

  return NextResponse.json({
    success: true,
    first_name: firstName,
    last_name: lastName,
    display_name: `${firstName} ${lastName}`,
    has_forum_identity: true,
  });
}
