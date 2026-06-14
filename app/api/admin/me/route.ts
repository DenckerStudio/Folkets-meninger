import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { isForumAdmin } from '@/lib/forum/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ admin: false });
  }
  const admin = await isForumAdmin(user.id, user.email);
  return NextResponse.json({ admin });
}
