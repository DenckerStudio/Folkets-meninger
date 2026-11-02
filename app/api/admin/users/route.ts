import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import {
  AdminUsersServiceError,
  bulkAdminUsersAction,
  listAdminUsers,
  serviceErrorStatus,
} from '@/lib/admin/users/service';
import { adminUserBulkSchema, adminUserListQuerySchema } from '@/lib/admin/users/schemas';

export const dynamic = 'force-dynamic';

function handleServiceError(error: unknown) {
  if (error instanceof AdminUsersServiceError) {
    return NextResponse.json({ error: error.message }, { status: serviceErrorStatus(error) });
  }
  console.error('admin users failed', error);
  return NextResponse.json({ error: 'Kunne ikke behandle forespørselen' }, { status: 500 });
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Serveren er ikke konfigurert' }, { status: 503 });
  }

  const url = new URL(request.url);
  const parsed = adminUserListQuerySchema.safeParse({
    q: url.searchParams.get('q') ?? undefined,
    role: url.searchParams.get('role') ?? undefined,
    tier: url.searchParams.get('tier') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    sort: url.searchParams.get('sort') ?? undefined,
    order: url.searchParams.get('order') ?? undefined,
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  try {
    const result = await listAdminUsers(auth.userId, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Serveren er ikke konfigurert' }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 });
  }

  const parsed = adminUserBulkSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  try {
    const result = await bulkAdminUsersAction(auth.userId, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return handleServiceError(error);
  }
}
