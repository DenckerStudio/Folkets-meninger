import { NextResponse } from 'next/server';
import { isSameOriginPost } from '@/lib/api/same-origin-post';
import {
  AccountDeleteBlockedError,
  deleteOwnAccount,
} from '@/lib/account-delete/service';
import { ACCOUNT_DELETE_CONFIRMATION_TOKEN, ACCOUNT_DELETED_QUERY_PARAM } from '@/lib/account-delete/constants';
import { routes } from '@/lib/routes';
import { checkRateLimit } from '@/lib/rate-limit';
import { getServerSupabase } from '@/lib/supabase-server';
import { trustedClientIp } from '@/lib/trusted-client-ip';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameOriginPost(request)) {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 403 });
  }

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Ikke konfigurert' }, { status: 503 });
  }

  const ip = trustedClientIp(request);
  const ipRate = await checkRateLimit(`user-delete-account:ip:${ip}`, 10, 60_000);
  if (!ipRate.ok) {
    return NextResponse.json(
      { error: 'For mange forespørsler. Prøv igjen om litt.' },
      {
        status: 429,
        headers: { 'Retry-After': String(ipRate.retryAfterSeconds) },
      },
    );
  }

  const userRate = await checkRateLimit(`user-delete-account:user:${user.id}`, 3, 3_600_000);
  if (!userRate.ok) {
    return NextResponse.json(
      { error: 'For mange slettingsforsøk. Prøv igjen senere.' },
      {
        status: 429,
        headers: { 'Retry-After': String(userRate.retryAfterSeconds) },
      },
    );
  }

  const body = await request.json().catch(() => ({}));
  const confirmation =
    typeof body?.confirmation === 'string' ? body.confirmation.trim() : '';
  if (confirmation !== ACCOUNT_DELETE_CONFIRMATION_TOKEN) {
    return NextResponse.json({ error: 'Bekreftelsen stemmer ikke' }, { status: 400 });
  }

  try {
    await deleteOwnAccount(user.id);
  } catch (err) {
    if (err instanceof AccountDeleteBlockedError) {
      const status = err.reason === 'missing_migration' ? 503 : 409;
      return NextResponse.json({ error: err.message, reason: err.reason }, { status });
    }
    console.error('delete-account', err);
    return NextResponse.json({ error: 'Kunne ikke slette kontoen' }, { status: 500 });
  }

  const redirectTo = `${routes.home}?${ACCOUNT_DELETED_QUERY_PARAM}=1`;
  return NextResponse.json({ ok: true, redirectTo });
}