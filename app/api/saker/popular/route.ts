import { NextResponse } from 'next/server';
import { getPopularSaker } from '@/lib/stortinget-saker-cache';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 10), 1), 20);

  const popular = (await getPopularSaker(limit)).map((issue) => ({
      id: issue.id,
      title: issue.title,
      summary: issue.summary,
      category: issue.category,
      date: issue.date,
      votes: {
        for: issue.votes.for,
        against: issue.votes.against,
        total: issue.votes.total,
      },
    }));

  return NextResponse.json(
    { issues: popular },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    },
  );
}
