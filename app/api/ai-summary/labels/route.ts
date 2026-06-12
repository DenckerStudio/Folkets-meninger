import { NextResponse } from 'next/server';
import { getPopularAiLabels } from '@/lib/ai-summary/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const labels = await getPopularAiLabels(60);
    return NextResponse.json({ labels });
  } catch (e) {
    console.error('AI labels GET error', e);
    return NextResponse.json({ error: 'Kunne ikke hente emner' }, { status: 500 });
  }
}
