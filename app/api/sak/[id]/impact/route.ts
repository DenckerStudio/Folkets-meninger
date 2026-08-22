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
  const result = await calculateSakImpact(id, profile);

  return NextResponse.json(result);
}
