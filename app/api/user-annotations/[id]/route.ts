import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { getServerSupabase } from '@/lib/supabase-server';
import { parseUpdateUserAnnotationBody, rowToPublic } from '@/lib/user-annotations/validate';

export const dynamic = 'force-dynamic';

const ANNOTATION_COLUMNS =
  'id, user_id, target_type, target_id, container_key, quote, note, flag_type, start_offset, end_offset, anchor_prefix, anchor_suffix, created_at, updated_at';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const annotationId = id?.trim() ?? '';
  if (!annotationId) {
    return NextResponse.json({ error: 'Mangler id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 });
  }

  const parsed = parseUpdateUserAnnotationBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if ('note' in parsed.value) {
    patch.note = parsed.value.note ?? null;
  }
  if ('flag_type' in parsed.value && parsed.value.flag_type) {
    patch.flag_type = parsed.value.flag_type;
  }

  const supabase = await getServerSupabase();

  const { data, error } = await supabase
    .from('user_annotations')
    .update(patch)
    .eq('id', annotationId)
    .select(ANNOTATION_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error('user-annotations PATCH', error.message);
    return NextResponse.json({ error: 'Kunne ikke oppdatere notat' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Fant ikke notatet' }, { status: 404 });
  }

  return NextResponse.json({
    annotation: rowToPublic(data as Parameters<typeof rowToPublic>[0]),
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const annotationId = id?.trim() ?? '';
  if (!annotationId) {
    return NextResponse.json({ error: 'Mangler id' }, { status: 400 });
  }

  const supabase = await getServerSupabase();

  const { error, count } = await supabase
    .from('user_annotations')
    .delete({ count: 'exact' })
    .eq('id', annotationId);

  if (error) {
    console.error('user-annotations DELETE', error.message);
    return NextResponse.json({ error: 'Kunne ikke slette notat' }, { status: 500 });
  }

  if (!count) {
    return NextResponse.json({ error: 'Fant ikke notatet' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}