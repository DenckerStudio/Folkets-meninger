import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export function GET() {
  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE_HEADERS });
}

export function HEAD() {
  return new NextResponse(null, { status: 200, headers: NO_STORE_HEADERS });
}
