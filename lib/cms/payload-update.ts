import { getCmsAgentKey, getCmsBaseUrl } from '@/lib/cms/payload-client';
import type { PayloadPost } from '@/lib/cms/types';

export type PayloadPatchPostResult =
  | { ok: true; id: string; doc?: PayloadPost }
  | { ok: false; status: number; error: string };

export type PayloadPatchPostOptions = {
  /** When true, append `draft=true` so Payload updates the draft version only. */
  draft?: boolean;
};

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

    let doc: PayloadPost | undefined;
    try {
      doc = (await res.json()) as PayloadPost;
    } catch {
      doc = undefined;
    }

    return { ok: true, id, doc };
  } catch (error) {
    console.error('[cms] patch post failed', { id, error });
    return { ok: false, status: 502, error: 'Kunne ikke nå CMS' };
  }
}
