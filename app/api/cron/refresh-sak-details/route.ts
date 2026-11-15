import { NextResponse } from 'next/server';
import { cronAuthResponse, verifyCronAuth } from '@/lib/cron-auth';
import {
  parseStortingetIssueIdsParam,
  refreshSakDetailsWithDocumentIngest,
} from '@/lib/stortinget-sak-document-backfill';

export const dynamic = 'force-dynamic';

async function handleRefresh(request: Request) {
  const auth = verifyCronAuth(request);
  if (!auth.ok) {
    return cronAuthResponse(auth);
  }

  const { searchParams } = new URL(request.url);
  const { valid, invalid } = parseStortingetIssueIdsParam(searchParams.get('ids'));

  if (valid.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Oppgi minst én gyldig numerisk sak-id i query ids (maks 10 per kall)',
        invalid,
      },
      { status: 400 },
    );
  }

  const results = await refreshSakDetailsWithDocumentIngest(valid);
  return NextResponse.json({
    ok: true,
    invalid,
    results,
  });
}

export async function GET(request: Request) {
  try {
    return await handleRefresh(request);
  } catch (error) {
    console.error('[document-ingest] Cron refresh-sak-details error', error);
    return NextResponse.json({ error: 'Cron error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    return await handleRefresh(request);
  } catch (error) {
    console.error('[document-ingest] Cron refresh-sak-details error', error);
    return NextResponse.json({ error: 'Cron error' }, { status: 500 });
  }
}