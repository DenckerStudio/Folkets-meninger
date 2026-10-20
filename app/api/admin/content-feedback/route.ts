import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/gate';
import { isValidContentId } from '@/lib/content-feedback/content-id';
import { getAdminContentFeedback } from '@/lib/content-feedback/service';
import {
  ADMIN_CONTENT_FEEDBACK_TYPES,
} from '@/lib/content-feedback/constants';
import {
  parseAdminContentFeedbackBody,
  submitAdminContentFeedback,
} from '@/lib/content-feedback/submit-admin-feedback';

export const dynamic = 'force-dynamic';

const querySchema = z
  .object({
    content_type: z.enum(ADMIN_CONTENT_FEEDBACK_TYPES),
    content_id: z.string().trim().min(1).max(200),
  })
  .strict();

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Serveren er ikke konfigurert' }, { status: 503 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    content_type: url.searchParams.get('content_type'),
    content_id: url.searchParams.get('content_id'),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }
  if (!isValidContentId(parsed.data.content_type, parsed.data.content_id)) {
    return NextResponse.json({ error: 'Ugyldig content_id' }, { status: 400 });
  }

  try {
    const feedback = await getAdminContentFeedback(
      parsed.data.content_type,
      parsed.data.content_id,
    );
    return NextResponse.json({ feedback });
  } catch (error) {
    console.error('content-feedback get failed', error);
    return NextResponse.json({ error: 'Kunne ikke hente tilbakemelding' }, { status: 500 });
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

  const parsed = parseAdminContentFeedbackBody(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const result = await submitAdminContentFeedback(auth.userId, parsed.body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, id: result.id });
}
