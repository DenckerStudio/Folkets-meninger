import { getCmsAgentKey, getCmsBaseUrl } from '@/lib/cms/payload-client';

export type PayloadPatchPostResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error: string };

export async function payloadPatchPost(
  id: string,
  body: Record<string, unknown>,
  apiKey?: string | null,
): Promise<PayloadPatchPostResult> {
  const base = getCmsBaseUrl();
  const key = apiKey ?? getCmsAgentKey();
  if (!base || !key) {
    return { ok: false, status: 503, error: 'CMS er ikke konfigurert' };
  }

  const url = `${base}/api/posts/${encodeURIComponent(id)}`;

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

    return { ok: true, id };
  } catch (error) {
    console.error('[cms] patch post failed', { id, error });
    return { ok: false, status: 502, error: 'Kunne ikke nå CMS' };
  }
}
