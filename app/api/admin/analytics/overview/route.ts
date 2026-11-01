import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { loadAdminAnalyticsOverview } from '@/lib/admin/analytics/overview';
import { adminLoadErrorJson, logPostgrestError } from '@/lib/admin/postgrest-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const overview = await loadAdminAnalyticsOverview(auth.userId);
    return NextResponse.json(overview);
  } catch (err) {
    logPostgrestError('[admin/analytics/overview]', err);
    return NextResponse.json(
      adminLoadErrorJson('Kunne ikke laste statistikk', err),
      { status: 500 },
    );
  }
}
