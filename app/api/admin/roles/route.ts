import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { grantAppRoleByEmail, listAppAdmins, revokeAppRoleByEmail } from '@/lib/admin/roles';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admins = await listAppAdmins();
  return NextResponse.json({ admins });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Serveren er ikke konfigurert' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!email) {
      return NextResponse.json({ error: 'Mangler e-post' }, { status: 400 });
    }
    const userId = await grantAppRoleByEmail(email, auth.userId);
    return NextResponse.json({ ok: true, userId, email });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: 'Bruker ikke funnet' }, { status: 404 });
    }
    console.error('Grant admin failed', error);
    return NextResponse.json({ error: 'Kunne ikke gi admin-rolle' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Serveren er ikke konfigurert' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!email) {
      return NextResponse.json({ error: 'Mangler e-post' }, { status: 400 });
    }
    const userId = await revokeAppRoleByEmail(email);
    return NextResponse.json({ ok: true, userId, email });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.toLowerCase().includes('last admin')) {
      return NextResponse.json({ error: 'Kan ikke fjerne siste administrator' }, { status: 409 });
    }
    if (message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: 'Bruker ikke funnet' }, { status: 404 });
    }
    console.error('Revoke admin failed', error);
    return NextResponse.json({ error: 'Kunne ikke fjerne admin-rolle' }, { status: 500 });
  }
}
