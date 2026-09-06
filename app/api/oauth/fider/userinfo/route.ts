import { NextResponse } from 'next/server';
import { bearerTokenFromRequest, ensureFiderOAuthConfigured } from '@/lib/fider/oauth-http';
import { verifyAccessToken } from '@/lib/fider/oauth-tokens';
import { getFiderOAuthClientSecret } from '@/lib/fider/config';
import { resolveFiderUserProfile } from '@/lib/fider/oauth-user-profile';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const notConfigured = ensureFiderOAuthConfigured();
  if (notConfigured) return notConfigured;

  const token = bearerTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  const verified = verifyAccessToken(token, getFiderOAuthClientSecret());
  if (!verified) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  const service = getServiceSupabase();
  let authUser;
  try {
    const { data, error } = await service.auth.admin.getUserById(verified.userId);
    if (error || !data.user) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
    }
    authUser = data.user;
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  const profile = await resolveFiderUserProfile(authUser);
  return NextResponse.json(profile);
}
