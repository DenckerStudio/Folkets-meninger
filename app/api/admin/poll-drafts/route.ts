import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';

export const dynamic = 'force-dynamic';

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json(
    {
      error:
        'Systemgenererte Reels-avstemninger er avviklet. Avstemninger opprettes når en mening i Folkets meninger får nok popularitet.',
    },
    { status: 410 },
  );
}
