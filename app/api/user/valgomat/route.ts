import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  getValgomatForUser,
  ValgomatServiceError,
} from '@/lib/valgomat/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('valgomat: SUPABASE_SERVICE_ROLE_KEY is not configured');
    return NextResponse.json(
      { error: 'Valgomat er ikke konfigurert på serveren (mangler service role key).' },
      { status: 503 },
    );
  }

  try {
    const result = await getValgomatForUser(user.id);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ValgomatServiceError) {
      console.error('valgomat service:', e.message);
      return NextResponse.json({ error: 'Kunne ikke hente stemmehistorikk' }, { status: 500 });
    }
    console.error('valgomat', e);
    return NextResponse.json({ error: 'Kunne ikke beregne valgomat' }, { status: 500 });
  }
}
