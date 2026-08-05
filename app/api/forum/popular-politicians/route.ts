import { NextResponse } from 'next/server';
import { getPopularPoliticians } from '@/lib/forum/popular-politicians';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results = await getPopularPoliticians(5);
  return NextResponse.json({ results });
}
