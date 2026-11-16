import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { getServerSupabase } from '@/lib/supabase-server';
import type { UserAnnotationPublic } from '@/lib/user-annotations/types';
import {
  isUserAnnotationCreatableTargetType,
  isUserAnnotationTargetType,
  parseCreateUserAnnotationBody,
  rowToPublic,
} from '@/lib/user-annotations/validate';

export const dynamic = 'force-dynamic';

const ANNOTATION_COLUMNS =
  'id, user_id, target_type, target_id, container_key, quote, note, flag_type, start_offset, end_offset, anchor_prefix, anchor_suffix, created_at, updated_at';

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const targetType = url.searchParams.get('target_type');
  const targetId = url.searchParams.get('target_id')?.trim() ?? '';

  if (!isUserAnnotationCreatableTargetType(targetType) || targetId.length === 0) {
    return NextResponse.json({ error: 'Ugyldige søkeparametre' }, { status: 400 });
  }

  const supabase = await getServerSupabase();

  const { data, error } = await supabase
    .from('user_annotations')
    .select(ANNOTATION_COLUMNS)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('user-annotations GET', error.message);
    return NextResponse.json({ error: 'Kunne ikke hente notater' }, { status: 500 });
  }

  const annotations: UserAnnotationPublic[] = (data ?? []).map((row) =>
    rowToPublic(row as Parameters<typeof rowToPublic>[0]),
  );

  return NextResponse.json({ annotations });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 });
  }

  const parsed = parseCreateUserAnnotationBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { value } = parsed;

  if (!isUserAnnotationTargetType(value.target_type)) {
    return NextResponse.json({ error: 'Ugyldig måltype' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('user_annotations')
    .insert({
      user_id: user.id,
      target_type: value.target_type,
      target_id: value.target_id,
      container_key: value.container_key,
      quote: value.quote,
      note: value.note,
      flag_type: value.flag_type,
      start_offset: value.start_offset,
      end_offset: value.end_offset,
      anchor_prefix: value.anchor_prefix,
      anchor_suffix: value.anchor_suffix,
    })
    .select(ANNOTATION_COLUMNS)
    .single();

  if (error || !data) {
    console.error('user-annotations POST', error?.message);
    return NextResponse.json({ error: 'Kunne ikke lagre markering' }, { status: 500 });
  }

  return NextResponse.json({
    annotation: rowToPublic(data as Parameters<typeof rowToPublic>[0]),
  });
}