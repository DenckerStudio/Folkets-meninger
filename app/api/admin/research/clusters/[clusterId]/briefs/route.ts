import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { getResearchBriefsByKindForCluster } from '@/lib/admin/research/service';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ clusterId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { clusterId } = await context.params;
  if (!clusterId?.trim()) {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  const briefsByKind = await getResearchBriefsByKindForCluster(clusterId.trim());
  return NextResponse.json({ briefs_by_kind: briefsByKind });
}
