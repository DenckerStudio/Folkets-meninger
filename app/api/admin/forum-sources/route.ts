import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireForumAdmin } from '@/lib/forum/admin';

export const dynamic = 'force-dynamic';

const SOURCE_STATUSES = ['approved', 'pending', 'rejected'] as const;

export async function GET() {
  const auth = await requireForumAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const service = getServiceSupabase();
  const { data, error } = await service
    .from('forum_trusted_sources')
    .select('*')
    .order('status', { ascending: true })
    .order('domain', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Kunne ikke hente kilder' }, { status: 500 });
  }

  return NextResponse.json({ sources: data || [] });
}

export async function POST(request: Request) {
  const auth = await requireForumAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const domain = String(body.domain || '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
  const outletLabel = String(body.outlet_label || '').trim();
  if (!domain || !outletLabel) {
    return NextResponse.json({ error: 'Domene og visningsnavn er påkrevd' }, { status: 400 });
  }

  const status = SOURCE_STATUSES.includes(body.status) ? body.status : 'pending';
  const service = getServiceSupabase();

  const row: Record<string, unknown> = {
    domain,
    outlet_label: outletLabel,
    status,
  };
  if (status === 'approved') {
    row.approved_at = new Date().toISOString();
    row.approved_by = auth.userId;
  }

  const { data, error } = await service
    .from('forum_trusted_sources')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Domenet finnes allerede' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Kunne ikke opprette kilde' }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id });
}

export async function PATCH(request: Request) {
  const auth = await requireForumAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: 'Mangler id' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.outlet_label) updates.outlet_label = String(body.outlet_label).trim();
  if (body.domain) {
    updates.domain = String(body.domain).trim().toLowerCase().replace(/^www\./, '');
  }
  if (SOURCE_STATUSES.includes(body.status)) {
    updates.status = body.status;
    if (body.status === 'approved') {
      updates.approved_at = new Date().toISOString();
      updates.approved_by = auth.userId;
    }
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'Ingen felter å oppdatere' }, { status: 400 });
  }

  const service = getServiceSupabase();
  const { error } = await service.from('forum_trusted_sources').update(updates).eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Kunne ikke oppdatere kilde' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
