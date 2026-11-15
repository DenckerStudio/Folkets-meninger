import { NextResponse } from 'next/server';
import { ensurePoliticalConsent } from '@/lib/consent/require-api';
import { getServerSupabase } from '@/lib/supabase-server';
import { getValgomatForSession, ValgomatServiceError } from '@/lib/valgomat/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  const storageConsent = await ensurePoliticalConsent(user.id, 'political_storage');
  if (storageConsent) return storageConsent;
  const profilingConsent = await ensurePoliticalConsent(user.id, 'political_profiling');
  if (profilingConsent) return profilingConsent;

  try {
    const result = await getValgomatForSession(supabase);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ValgomatServiceError) {
      console.error('valgomat service:', e.message);
      return NextResponse.json({ error: 'Kunne ikke hente holdningshistorikk' }, { status: 500 });
    }
    console.error('valgomat', e);
    return NextResponse.json({ error: 'Kunne ikke beregne valgomat' }, { status: 500 });
  }
}