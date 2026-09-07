import { NextResponse } from 'next/server';
import { getCitizenOpinion } from '@/lib/opinions/service';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const opinion = await getCitizenOpinion(id, user?.id ?? null);
  if (!opinion) {
    return NextResponse.json({ error: 'Meningen ble ikke funnet' }, { status: 404 });
  }

  return NextResponse.json(
    { opinion },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  );
}
