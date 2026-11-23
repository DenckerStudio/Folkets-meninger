import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { isAdmin } from '@/lib/admin/gate';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }
  const admin = await isAdmin(user.id, user.email);
  return NextResponse.json({ admin });
}
