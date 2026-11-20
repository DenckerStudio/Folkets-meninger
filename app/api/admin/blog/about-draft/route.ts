import { NextResponse } from 'next/server';
import { handleAboutDraftCreate, handleAboutDraftList } from '@/lib/blog/about-draft-api';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET() {
  const { status, body } = await handleAboutDraftList();
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  const { status, body } = await handleAboutDraftCreate(request);
  return NextResponse.json(body, { status });
}
