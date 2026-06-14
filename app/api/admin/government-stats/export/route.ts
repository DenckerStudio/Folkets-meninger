import { NextResponse } from 'next/server';
import { requireForumAdmin } from '@/lib/forum/admin';
import {
  buildGovernmentStatsSnapshot,
  snapshotToCsv,
} from '@/lib/government-stats/snapshot';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireForumAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') ?? 'json';
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') ?? '200', 10) || 200));

  const snapshot = await buildGovernmentStatsSnapshot({ limit });

  if (format === 'csv') {
    const csv = snapshotToCsv(snapshot);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="folkets-stemme-statistikk-${snapshot.generatedAt.slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json(snapshot);
}
