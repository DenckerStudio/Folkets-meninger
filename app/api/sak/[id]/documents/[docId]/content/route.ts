import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getCachedSakDetail } from '@/lib/stortinget-detail-cache';
import { parseSakDocuments } from '@/lib/stortinget-documents';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await params;
  const decodedDocId = decodeURIComponent(docId);

  const detail = await getCachedSakDetail(id);
  if (!detail) {
    return NextResponse.json({ error: 'Sak ikke funnet' }, { status: 404 });
  }

  const document = parseSakDocuments(detail).find((doc) => doc.id === decodedDocId);
  if (!document) {
    return NextResponse.json({ error: 'Dokument ikke funnet' }, { status: 404 });
  }

  if (!document.viewable) {
    return NextResponse.json({
      status: 'external_only',
      title: document.title,
      sourceUrl: document.sourceUrl,
    });
  }

  let service: ReturnType<typeof getServiceSupabase>;
  try {
    service = getServiceSupabase();
  } catch {
    return NextResponse.json({ status: 'pending', retry_after_seconds: 10 });
  }

  const { data: row } = await service
    .from('stortinget_issue_documents')
    .select('title, content_html, ingest_status, source_url')
    .eq('issue_id', id)
    .eq('document_id', decodedDocId)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ status: 'pending', retry_after_seconds: 10 });
  }

  if (row.ingest_status === 'external_only') {
    return NextResponse.json({
      status: 'external_only',
      title: row.title ?? document.title,
      sourceUrl: row.source_url ?? document.sourceUrl,
    });
  }

  if (row.ingest_status === 'failed') {
    return NextResponse.json({
      status: 'failed',
      title: row.title ?? document.title,
      sourceUrl: row.source_url ?? document.sourceUrl,
    });
  }

  if (row.ingest_status === 'ready' && row.content_html) {
    return NextResponse.json({
      status: 'ready',
      title: row.title ?? document.title,
      html: row.content_html,
    });
  }

  return NextResponse.json({ status: 'pending', retry_after_seconds: 8 });
}
