import { NextResponse } from 'next/server';
import { getActiveForumPromptsPage } from '@/lib/forum/prompt-queries';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 16), 4), 40);
  const cursor = searchParams.get('cursor') || undefined;

  const page = await getActiveForumPromptsPage({ limit, cursor });
  return NextResponse.json(page);
}

