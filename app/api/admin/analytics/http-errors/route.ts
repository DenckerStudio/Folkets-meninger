import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { loadAdminHttpErrors } from '@/lib/admin/analytics/http-errors';
import { adminLoadErrorJson, logPostgrestError } from '@/lib/admin/postgrest-error';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const daysRaw = Number(url.searchParams.get('days') ?? '30');
  const days = Number.isFinite(daysRaw) ? Math.min(90, Math.max(1, Math.trunc(daysRaw))) : 30;

  try {
    const overview = await loadAdminHttpErrors(auth.userId, days);
    return NextResponse.json(overview);
  } catch (err) {
    logPostgrestError('[admin/analytics/http-errors]', err);
    return NextResponse.json(
      adminLoadErrorJson('Kunne ikke laste HTTP-feilstatistikk', err),
      { status: 500 },
    );
  }
}
