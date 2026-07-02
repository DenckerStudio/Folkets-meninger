import { NextResponse } from 'next/server';
import { getActiveForumPromptsPage } from '@/lib/forum/prompt-queries';
import { requireForumReelsAccess } from '@/lib/forum/reels-visibility';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const access = await requireForumReelsAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 16), 4), 40);
  const cursor = searchParams.get('cursor') || undefined;

  const page = await getActiveForumPromptsPage({ limit, cursor });
  return NextResponse.json(page);
}

