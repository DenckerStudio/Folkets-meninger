import { NextResponse } from 'next/server';
import { calculateSakImpact } from '@/lib/impact/service';
import { parseImpactProfile } from '@/lib/impact/profile';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Mangler saks-ID' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const profile = parseImpactProfile(body);
  const title = typeof body.title === 'string' ? body.title.slice(0, 300) : null;
  const summary = typeof body.summary === 'string' ? body.summary.slice(0, 2000) : null;
  const result = await calculateSakImpact(id, profile, { title, summary });

  return NextResponse.json(result);
}
