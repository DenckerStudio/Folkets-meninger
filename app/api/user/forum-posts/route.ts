import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getUserForumPosts } from '@/lib/forum/user-activity';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const result = await getUserForumPosts(user.id, page);
  return NextResponse.json(result);
}
