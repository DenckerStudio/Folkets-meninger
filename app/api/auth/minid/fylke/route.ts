import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { isNorwayCountyCode } from '@/lib/polls/norway-counties';

export const dynamic = 'force-dynamic';

/**
 * Applies a verified fylke claim after MinID / ID-porten.
 *
 * Production: call only from a trusted IdP callback with server secrets.
 * Dev/mock: allowed when ALLOW_MOCK_MINID=true (or NODE_ENV=development).
 */
export async function POST(request: Request) {
  const allowMock =
    process.env.ALLOW_MOCK_MINID === 'true' || process.env.NODE_ENV === 'development';

  try {
    const body = await request.json().catch(() => ({}));
    const fylkeCode = typeof body.fylkeCode === 'string' ? body.fylkeCode.trim() : '';
    const sourceRaw = typeof body.source === 'string' ? body.source.trim() : 'mock_minid';
    const source =
      sourceRaw === 'minid' ||
      sourceRaw === 'idporten' ||
      sourceRaw === 'bankid' ||
      sourceRaw === 'mock_minid'
        ? sourceRaw
        : null;

    if (!source) {
      return NextResponse.json({ error: 'Ugyldig kilde' }, { status: 400 });
    }

    if (source === 'mock_minid' && !allowMock) {
      return NextResponse.json(
        { error: 'Mock MinID er deaktivert i dette miljøet' },
        { status: 403 },
      );
    }

    // Non-mock claims require an internal secret until real IdP callback exists
    if (source !== 'mock_minid') {
      const expected = process.env.MINID_CLAIM_SECRET;
      const provided = request.headers.get('x-minid-claim-secret');
      if (!expected || provided !== expected) {
        return NextResponse.json({ error: 'Uautorisert MinID-claim' }, { status: 401 });
      }
    }

    if (!isNorwayCountyCode(fylkeCode)) {
      return NextResponse.json({ error: 'Ugyldig fylkeskode' }, { status: 400 });
    }

    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Tjenesten er ikke konfigurert' }, { status: 503 });
    }

    const service = getServiceSupabase();
    const { data, error } = await service.rpc('apply_verified_fylke_claim', {
      p_user_id: user.id,
      p_fylke_code: fylkeCode,
      p_source: source,
    });

    if (error) {
      console.error('apply_verified_fylke_claim', error);
      return NextResponse.json({ error: 'Kunne ikke lagre verifisert fylke' }, { status: 500 });
    }

    return NextResponse.json({ success: true, claim: data });
  } catch (error) {
    console.error('MinID fylke claim error', error);
    return NextResponse.json({ error: 'Kunne ikke behandle MinID-claim' }, { status: 500 });
  }
}
