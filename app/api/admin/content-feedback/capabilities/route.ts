import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { isRegenerationOnRejectAvailable } from '@/lib/content-feedback/capabilities';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Serveren er ikke konfigurert' }, { status: 503 });
  }

  try {
    const regeneration_on_reject = await isRegenerationOnRejectAvailable();
    return NextResponse.json({ regeneration_on_reject });
  } catch (error) {
    console.error('content-feedback capabilities failed', error);
    return NextResponse.json({ error: 'Kunne ikke hente status' }, { status: 500 });
  }
}
