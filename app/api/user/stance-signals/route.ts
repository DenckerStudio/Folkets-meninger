import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { getUserStanceSignals } from '@/lib/stances/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ categories: [], labels: [] });
    }

    const service = getServiceSupabase();
    const signals = await getUserStanceSignals(service, user.id);
    return NextResponse.json(signals);
  } catch (error) {
    console.error('Stance signals error:', error);
    return NextResponse.json({ categories: [], labels: [] });
  }
}
