import { NextResponse } from 'next/server';
import { isSameOriginPost } from '@/lib/api/same-origin-post';
import {
  AccountDeleteBlockedError,
  deleteOwnAccount,
  getSelfDeleteEligibility,
} from '@/lib/account-delete/service';
import { accountDeleteConfirmationMatches } from '@/lib/account-delete/confirmation';
import {
  ACCOUNT_DELETED_QUERY_PARAM,
  SELF_DELETE_AUTH_PENDING_MESSAGE,
  SELF_DELETE_RPC_FAILED_MESSAGE,
} from '@/lib/account-delete/constants';
import { routes } from '@/lib/routes';
import { checkRateLimit } from '@/lib/rate-limit';
import { getServerSupabase } from '@/lib/supabase-server';
import { trustedClientIp } from '@/lib/trusted-client-ip';

export const dynamic = 'force-dynamic';

export async function GET() {
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

  try {
    const eligibility = await getSelfDeleteEligibility(user.id);
    return NextResponse.json(eligibility);
  } catch (err) {
    console.error('delete-account eligibility', err);
    return NextResponse.json({ error: 'Kunne ikke hente status for kontosletting' }, { status: 500 });
  }
}

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
  const confirmation = typeof body?.confirmation === 'string' ? body.confirmation : '';
  if (!accountDeleteConfirmationMatches(confirmation)) {
    return NextResponse.json({ error: 'Bekreftelsen stemmer ikke' }, { status: 400 });
  }

  try {
    const result = await deleteOwnAccount(user.id);
    const redirectTo = `${routes.home}?${ACCOUNT_DELETED_QUERY_PARAM}=1`;
    if (result === 'auth_pending') {
      return NextResponse.json({
        ok: true,
        auth_pending: true,
        message: SELF_DELETE_AUTH_PENDING_MESSAGE,
        redirectTo,
      });
    }
    return NextResponse.json({ ok: true, redirectTo });
  } catch (err) {
    if (err instanceof AccountDeleteBlockedError) {
      const status = err.reason === 'missing_migration' ? 503 : 409;
      return NextResponse.json({ error: err.message, reason: err.reason }, { status });
    }
    console.error('delete-account', err);
    const message = err instanceof Error && err.message === SELF_DELETE_RPC_FAILED_MESSAGE
      ? err.message
      : SELF_DELETE_RPC_FAILED_MESSAGE;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}