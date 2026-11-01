import { NextResponse } from 'next/server';
import {
  isShareTargetId,
  isShareTargetKind,
  personalSharePath,
} from '@/lib/polls/share-personal';
import { checkRateLimit } from '@/lib/rate-limit';
import { getServiceSupabase } from '@/lib/supabase';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const WINDOW_MS = 60_000;
const IP_LIMIT = 30;
const USER_LIMIT = 20;

type Gate =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function serviceConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
  );
}

function tooMany(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: 'For mange forespørsler' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    },
  );
}

async function gate(request: Request): Promise<Gate> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 }),
    };
  }
  if (!serviceConfigured()) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Serveren er ikke konfigurert' }, { status: 503 }),
    };
  }

  const ipRate = await checkRateLimit(`share-links:ip:${clientIp(request)}`, IP_LIMIT, WINDOW_MS);
  if (!ipRate.ok) {
    return { ok: false, response: tooMany(ipRate.retryAfterSeconds) };
  }
  const userRate = await checkRateLimit(`share-links:user:${user.id}`, USER_LIMIT, WINDOW_MS);
  if (!userRate.ok) {
    return { ok: false, response: tooMany(userRate.retryAfterSeconds) };
  }
  return { ok: true, userId: user.id };
}

function invalidTarget(): NextResponse {
  return NextResponse.json({ error: 'Ugyldig delingsmål' }, { status: 400 });
}

function parseLabel(value: unknown): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 80);
}

function parseCreateBody(
  body: unknown,
): { targetKind: string; targetId: string; label: string | null } | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (typeof record.targetKind !== 'string' || !isShareTargetKind(record.targetKind)) {
    return null;
  }
  if (typeof record.targetId !== 'string') return null;
  const targetId = record.targetId.trim();
  if (!isShareTargetId(targetId)) return null;
  const label = parseLabel(record.label);
  if (label === undefined) return null;
  return { targetKind: record.targetKind, targetId, label };
}

function readCreatedLink(data: unknown): { id: string; code: string } | null {
  const record = asRecord(data);
  if (!record) return null;
  if (typeof record.id !== 'string' || typeof record.code !== 'string' || !record.code) {
    return null;
  }
  return { id: record.id, code: record.code };
}

function asRecord(data: unknown): Record<string, unknown> | null {
  if (typeof data === 'string') {
    try {
      return asRecord(JSON.parse(data) as unknown);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

function asArray(data: unknown): unknown[] | null {
  if (typeof data === 'string') {
    try {
      return asArray(JSON.parse(data) as unknown);
    } catch {
      return null;
    }
  }
  return Array.isArray(data) ? data : null;
}

type ListedLink = {
  id: string;
  code: string;
  target_kind: string;
  target_id: string;
  label: string | null;
  created_at: string;
  path: string;
};

function readListedLinks(data: unknown): ListedLink[] | null {
  const rows = asArray(data);
  if (!rows) return null;
  const links: ListedLink[] = [];
  for (const item of rows) {
    const record = asRecord(item);
    if (!record) return null;
    if (
      typeof record.id !== 'string' ||
      typeof record.code !== 'string' ||
      typeof record.target_kind !== 'string' ||
      typeof record.target_id !== 'string'
    ) {
      return null;
    }
    const label = record.label == null ? null : typeof record.label === 'string' ? record.label : null;
    const createdAt =
      typeof record.created_at === 'string' ? record.created_at : String(record.created_at ?? '');
    links.push({
      id: record.id,
      code: record.code,
      target_kind: record.target_kind,
      target_id: record.target_id,
      label,
      created_at: createdAt,
      path: personalSharePath(record.code),
    });
  }
  return links;
}

function rpcError(error: { code?: string | null; message?: string | null }, fallback: string): NextResponse {
  if (error.code === 'PGRST202') {
    return NextResponse.json({ error: 'Serveren er ikke konfigurert' }, { status: 503 });
  }
  if (error.code === '22023' || (error.message ?? '').includes('Ugyldig delingsmål')) {
    return invalidTarget();
  }
  console.error(`${fallback}: ${error.code ?? 'unknown'}`);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function POST(request: Request) {
  const access = await gate(request);
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidTarget();
  }
  const parsed = parseCreateBody(body);
  if (!parsed) return invalidTarget();

  const service = getServiceSupabase();
  const { data, error } = await service.rpc('create_share_link', {
    p_user_id: access.userId,
    p_target_kind: parsed.targetKind,
    p_target_id: parsed.targetId,
    p_label: parsed.label,
  });
  if (error) {
    return rpcError(error, 'Kunne ikke lage delingslenke');
  }
  const link = readCreatedLink(data);
  if (!link) {
    return NextResponse.json({ error: 'Kunne ikke lage delingslenke' }, { status: 500 });
  }
  return NextResponse.json({
    link: {
      id: link.id,
      code: link.code,
      path: personalSharePath(link.code),
    },
  });
}

export async function GET(request: Request) {
  const access = await gate(request);
  if (!access.ok) return access.response;

  const service = getServiceSupabase();
  const { data, error } = await service.rpc('list_my_share_links', {
    p_user_id: access.userId,
  });
  if (error) {
    return rpcError(error, 'Kunne ikke hente delingslenker');
  }
  const links = readListedLinks(data);
  if (!links) {
    return NextResponse.json({ error: 'Kunne ikke hente delingslenker' }, { status: 500 });
  }
  return NextResponse.json({ links });
}
