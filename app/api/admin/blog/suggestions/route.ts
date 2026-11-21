import { NextResponse } from 'next/server';
import { handleAboutSuggestionsList, handleAboutSuggestionsPost } from '@/lib/blog/about-suggestions-api';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const { status, body } = await handleAboutSuggestionsList();
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  const { status, body } = await handleAboutSuggestionsPost(request);
  return NextResponse.json(body, { status });
}
