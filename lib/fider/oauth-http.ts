import { NextResponse } from 'next/server';
import {
  getFiderOAuthClientId,
  getFiderOAuthClientSecret,
  isFiderConfigured,
} from '@/lib/fider/config';

export function fiderOAuthNotConfiguredResponse(): NextResponse {
  return NextResponse.json({ error: 'Fider OAuth is not configured' }, { status: 503 });
}

export function ensureFiderOAuthConfigured(): NextResponse | null {
  if (!isFiderConfigured()) {
    return fiderOAuthNotConfiguredResponse();
  }
  return null;
}

export async function parseOAuthFormBody(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await request.json()) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, String(value ?? '')]),
    );
  }

  const raw = await request.text();
  if (!raw.trim()) return {};

  const params = new URLSearchParams(raw);
  return Object.fromEntries(params.entries());
}

export function validateOAuthClientCredentials(
  clientId: string | null | undefined,
  clientSecret: string | null | undefined,
): boolean {
  if (!clientId || !clientSecret) return false;
  try {
    return clientId === getFiderOAuthClientId() && clientSecret === getFiderOAuthClientSecret();
  } catch {
    return false;
  }
}

export function bearerTokenFromRequest(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}
