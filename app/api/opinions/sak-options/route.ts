import { NextResponse } from 'next/server';
import { listSakPickerOptions } from '@/lib/opinions/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const options = await listSakPickerOptions(300, { live: true });
  return NextResponse.json(
    { options },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  );
}
