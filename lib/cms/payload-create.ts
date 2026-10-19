import { getCmsBaseUrl, getCmsAgentKey } from '@/lib/cms/payload-client';

export type PayloadCreatePostDoc = {
  id: string;
  slug: string;
  _status?: string;
};

export type PayloadCreatePostResult =
  | { ok: true; doc: PayloadCreatePostDoc }
  | { ok: false; status: number; error: string };

type PayloadFieldError = { message?: string; path?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Accept Payload 3 `{ doc, message }` and legacy flat document shapes. */
export function parsePayloadCreatePostResponse(body: unknown): PayloadCreatePostDoc | null {
  if (!isRecord(body)) return null;

  const docSource = isRecord(body.doc) ? body.doc : body;
  const id = docSource.id;
  const slug = docSource.slug;
  if (id == null || typeof slug !== 'string' || !slug.trim()) {
    return null;
  }

  const status = docSource._status;
  return {
    id: String(id),
    slug,
    _status: typeof status === 'string' ? status : undefined,
  };
}

export function formatPayloadValidationMessage(body: unknown): string | null {
  if (!isRecord(body)) return null;

  const errors = body.errors;
  if (!Array.isArray(errors) || errors.length === 0) {
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    return message || null;
  }

  const parts = errors
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const fieldError = entry as PayloadFieldError;
      const message = typeof fieldError.message === 'string' ? fieldError.message.trim() : '';
      if (!message) return null;
      const path = typeof fieldError.path === 'string' ? fieldError.path.trim() : '';
      return path ? `${path}: ${message}` : message;
    })
    .filter((part): part is string => Boolean(part));

  if (parts.length === 0) return null;
  return parts.join('; ');
}

export async function payloadCreatePost(
  path: string,
  body: unknown,
): Promise<PayloadCreatePostResult> {
  const base = getCmsBaseUrl();
  const apiKey = getCmsAgentKey();
  if (!base || !apiKey) {
    return { ok: false, status: 503, error: 'CMS er ikke konfigurert' };
  }

  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `users API-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = null;
      }
    }

    if (!res.ok) {
      const validation = formatPayloadValidationMessage(parsed);
      console.error('[cms] create draft failed', {
        status: res.status,
        errors: isRecord(parsed) && Array.isArray(parsed.errors) ? parsed.errors : undefined,
      });
      if (validation) {
        return {
          ok: false,
          status: 502,
          error: `CMS avviste utkastet: ${validation}`,
        };
      }
      return {
        ok: false,
        status: 502,
        error: 'CMS avviste utkastet',
      };
    }

    const doc = parsePayloadCreatePostResponse(parsed);
    if (!doc) {
      return { ok: false, status: 502, error: 'Ugyldig svar fra CMS ved opprettelse av utkast' };
    }

    return { ok: true, doc };
  } catch (error) {
    console.error('[cms] create draft failed', { error });
    return { ok: false, status: 502, error: 'Kunne ikke nå CMS' };
  }
}
