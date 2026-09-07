import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { getUserStanceHistory } from '@/lib/stances/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json([], { status: 200 });
    }

    const service = getServiceSupabase();
    const history = await getUserStanceHistory(service, user.id);
    return NextResponse.json(history);
  } catch (error) {
    console.error('Stance history error:', error);
    return NextResponse.json([]);
  }
}
