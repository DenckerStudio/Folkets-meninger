import { NextResponse } from 'next/server';
import { requireForumAdmin } from '@/lib/forum/admin';
import {
  listOpenForumReports,
  updateForumReportStatus,
} from '@/lib/forum/admin-reports';
import { isValidUuid } from '@/lib/forum/validation';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireForumAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const reports = await listOpenForumReports();
  return NextResponse.json({ reports });
}

export async function PATCH(request: Request) {
  const auth = await requireForumAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const id = body.id;
  const status = body.status;
  const adminNote = body.admin_note;

  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Ugyldig rapport' }, { status: 400 });
  }

  if (status !== 'reviewed' && status !== 'dismissed') {
    return NextResponse.json({ error: 'Ugyldig status' }, { status: 400 });
  }

  const result = await updateForumReportStatus(
    id,
    status,
    typeof adminNote === 'string' ? adminNote : null,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
