import { NextResponse } from 'next/server';
import { getCachedSakDetail } from '@/lib/stortinget-detail-cache';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const detail = await getCachedSakDetail(id);

  if (!detail) {
    return NextResponse.json({ error: 'Sak ikke funnet' }, { status: 404 });
  }

  return NextResponse.json(detail);
}
