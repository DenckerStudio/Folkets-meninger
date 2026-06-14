import { NextResponse } from 'next/server';
import { fetchStortingetHoringById } from '@/lib/stortinget-horinger';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const hearing = await fetchStortingetHoringById(id);
    if (!hearing) {
      return NextResponse.json({ error: 'Høring ikke funnet' }, { status: 404 });
    }
    return NextResponse.json({ hearing });
  } catch (error) {
    console.error('horinger detail', error);
    return NextResponse.json({ error: 'Kunne ikke hente høring' }, { status: 500 });
  }
}
