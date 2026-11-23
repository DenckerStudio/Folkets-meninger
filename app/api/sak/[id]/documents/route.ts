import { NextResponse } from 'next/server';
import { trackedJsonError } from '@/lib/analytics/track-json-error';
import { getCachedSakDetail } from '@/lib/stortinget-detail-cache';
import { getSakDocumentsWithStatus } from '@/lib/stortinget-document-ingest';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const detail = await getCachedSakDetail(id);

  if (!detail) {
    return trackedJsonError(request, { error: 'Sak ikke funnet' }, 404);
  }

  const documents = await getSakDocumentsWithStatus(id, detail);
  return NextResponse.json({ documents });
}
