import { getCmsAgentKey, getCmsBaseUrl } from '@/lib/cms/payload-client';
import type { PayloadPost } from '@/lib/cms/types';

export const PAYLOAD_PATCH_INVALID_RESPONSE = 'CMS returnerte et ugyldig svar.';
export const PAYLOAD_PATCH_ID_MISMATCH = 'CMS returnerte et svar for et annet innlegg.';

export type PayloadPatchPostResult =
  | { ok: true; id: string; doc: PayloadPost }
  | { ok: false; status: number; error: string };

export type PayloadPatchPostOptions = {
  /** When true, append `draft=true` so Payload updates the draft version only. */
  draft?: boolean;
};

export type ParsePayloadPatchPostResult =
  | { ok: true; doc: PayloadPost }
  | { ok: false; error: string };

export function parsePayloadPatchPostResponse(
  requestedId: string,
  json: unknown,
): ParsePayloadPatchPostResult {
  if (!json || typeof json !== 'object') {
    return { ok: false, error: PAYLOAD_PATCH_INVALID_RESPONSE };
  }

  const envelope = json as Record<string, unknown>;
  const candidate = envelope.doc ?? json;
  if (!candidate || typeof candidate !== 'object') {
    return { ok: false, error: PAYLOAD_PATCH_INVALID_RESPONSE };
  }

  const post = candidate as Record<string, unknown>;
  const rawId = post.id;
  if (rawId === undefined || rawId === null || String(rawId).trim() === '') {
    return { ok: false, error: PAYLOAD_PATCH_INVALID_RESPONSE };
  }

  if (String(rawId) !== String(requestedId)) {
    return { ok: false, error: PAYLOAD_PATCH_ID_MISMATCH };
  }

  return { ok: true, doc: candidate as PayloadPost };
}

export async function payloadPatchPost(
  id: string,
  body: Record<string, unknown>,
  apiKey?: string | null,
  options?: PayloadPatchPostOptions,
): Promise<PayloadPatchPostResult> {
  const base = getCmsBaseUrl();
  const key = apiKey ?? getCmsAgentKey();
  if (!base || !key) {
    return { ok: false, status: 503, error: 'CMS er ikke konfigurert' };
  }

  const draftQuery = options?.draft ? '?draft=true' : '';
  const url = `${base}/api/posts/${encodeURIComponent(id)}${draftQuery}`;

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `users API-Key ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!res.ok) {
      return { ok: false, status: 502, error: `CMS returnerte HTTP ${res.status}` };
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { ok: false, status: 502, error: PAYLOAD_PATCH_INVALID_RESPONSE };
    }

    const parsed = parsePayloadPatchPostResponse(id, json);
    if (!parsed.ok) {
      return { ok: false, status: 502, error: parsed.error };
    }

    return { ok: true, id, doc: parsed.doc };
  } catch (error) {
    console.error('[cms] patch post failed', { id, error });
    return { ok: false, status: 502, error: 'Kunne ikke nå CMS' };
  }
}
