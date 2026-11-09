import { NextResponse } from 'next/server';
import { listPublicResearchTopics } from '@/lib/research-topics/public-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 6), 1), 12);

  try {
    const topics = await listPublicResearchTopics(limit);
    return NextResponse.json(
      { topics },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
        },
      },
    );
  } catch {
    return NextResponse.json(
      { topics: [], error: 'last_feil' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
