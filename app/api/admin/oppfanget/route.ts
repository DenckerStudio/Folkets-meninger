import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { parseOppfangetFilters } from '@/lib/admin/oppfanget/query';
import { listOppfangetForAdmin } from '@/lib/admin/oppfanget/service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  try {
    const params = Object.fromEntries(url.searchParams.entries());
    const payload = await listOppfangetForAdmin(
      parseOppfangetFilters(params),
      url.searchParams.get('preview'),
    );
    return NextResponse.json(payload);
  } catch (error) {
    console.error('research list failed', error);
    return NextResponse.json({ error: 'Kunne ikke hente Research-liste' }, { status: 500 });
  }
}
