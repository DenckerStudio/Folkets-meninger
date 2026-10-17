import { NextResponse } from 'next/server';
import {
  loadPoliticalConsentState,
  recordPoliticalConsents,
  withdrawAllPoliticalConsents,
} from '@/lib/consent/service';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

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

  const service = getServiceSupabase();
  const state = await loadPoliticalConsentState(service, user.id);
  return NextResponse.json(state);
}

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => ({}));
  const service = getServiceSupabase();

  if (body?.action === 'withdraw_all') {
    await withdrawAllPoliticalConsents(service, user.id);
    const state = await loadPoliticalConsentState(service, user.id);
    return NextResponse.json({ ok: true, ...state });
  }

  const storage = body?.storage === true;
  const profiling = body?.profiling === true;
  const byokActivity = body?.byokActivity === true;

  if (!storage) {
    return NextResponse.json(
      { error: 'Samtykke til lagring av holdninger og stemmer er påkrevd for å bruke denne funksjonen.' },
      { status: 400 },
    );
  }

  await recordPoliticalConsents(service, user.id, { storage, profiling, byokActivity });
  const state = await loadPoliticalConsentState(service, user.id);
  return NextResponse.json({ ok: true, ...state });
}
