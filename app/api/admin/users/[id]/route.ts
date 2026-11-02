import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import {
  AdminUsersServiceError,
  anonymizeAdminUserProfile,
  deactivateAdminUser,
  getAdminUserById,
  hardDeleteAdminUser,
  patchAdminUser,
  serviceErrorStatus,
} from '@/lib/admin/users/service';
import {
  adminUserDeleteQuerySchema,
  adminUserHardDeleteBodySchema,
  adminUserPatchSchema,
} from '@/lib/admin/users/schemas';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

function handleServiceError(error: unknown) {
  if (error instanceof AdminUsersServiceError) {
    return NextResponse.json({ error: error.message }, { status: serviceErrorStatus(error) });
  }
  console.error('admin user detail failed', error);
  return NextResponse.json({ error: 'Kunne ikke behandle forespørselen' }, { status: 500 });
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Serveren er ikke konfigurert' }, { status: 503 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  try {
    const user = await getAdminUserById(auth.userId, id);
    if (!user) {
      return NextResponse.json({ error: 'Bruker ikke funnet' }, { status: 404 });
    }
    return NextResponse.json({ user });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Serveren er ikke konfigurert' }, { status: 503 });
  }

  const { id } = await context.params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 });
  }

  const parsed = adminUserPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  try {
    await patchAdminUser(auth.userId, id, parsed.data);
    const user = await getAdminUserById(auth.userId, id);
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Serveren er ikke konfigurert' }, { status: 503 });
  }

  const { id } = await context.params;
  const url = new URL(request.url);
  const modeParsed = adminUserDeleteQuerySchema.safeParse({
    mode: url.searchParams.get('mode') ?? 'deactivate',
  });
  if (!modeParsed.success) {
    return NextResponse.json({ error: 'Ugyldig slettemodus' }, { status: 400 });
  }

  try {
    if (modeParsed.data.mode === 'hard') {
      let raw: unknown;
      try {
        raw = await request.json();
      } catch {
        return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 });
      }
      const bodyParsed = adminUserHardDeleteBodySchema.safeParse(raw);
      if (!bodyParsed.success) {
        return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
      }
      await hardDeleteAdminUser(auth.userId, id, bodyParsed.data.confirmEmail);
    } else if (modeParsed.data.mode === 'deactivate') {
      await deactivateAdminUser(auth.userId, id);
    } else {
      await anonymizeAdminUserProfile(auth.userId, id);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (!(error instanceof AdminUsersServiceError) && error && typeof error === 'object') {
      const pgError = error as { code?: string; message?: string };
      if (pgError.code === 'PGRST202') {
        return NextResponse.json(
          {
            error: 'Brukeradmin er ikke tilgjengelig ennå (database-migrasjon mangler)',
          },
          { status: 503 },
        );
      }
    }
    return handleServiceError(error);
  }
}
