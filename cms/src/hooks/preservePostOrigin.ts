import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload';
import { isAgent, type UserLike } from '@/access/roles';

type PostDoc = { id?: string | number; origin?: string };

/** Set on trusted server creates (ops/agent) via `req.context`. */
export const POST_ORIGIN_CONTEXT_KEY = 'allowPostOrigin';

function trustedOriginFromRequest(
  req: PayloadRequest,
  data: PostDoc,
): 'manual' | 'n8n' {
  const fromContext = req.context[POST_ORIGIN_CONTEXT_KEY];
  if (fromContext === 'n8n' || fromContext === 'manual') {
    return fromContext;
  }
  if (isAgent(req.user as UserLike)) {
    return data.origin === 'n8n' ? 'n8n' : 'manual';
  }
  return 'manual';
}

/** `origin` is set on create by trusted server paths only; immutable after create. */
export const preservePostOrigin: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
  operation,
}) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (operation === 'create') {
    (data as PostDoc).origin = trustedOriginFromRequest(req, data as PostDoc);
    return data;
  }

  if (operation !== 'update') {
    return data;
  }

  const id = (data as PostDoc).id ?? (originalDoc as PostDoc)?.id;
  if (id == null) {
    return data;
  }

  try {
    const main = await req.payload.findByID({
      collection: 'posts',
      id,
      draft: false,
      depth: 0,
      req,
    });
    const origin = (main as PostDoc).origin;
    if (origin) {
      (data as PostDoc).origin = origin;
    }
  } catch {
    const fallback = (originalDoc as PostDoc)?.origin;
    if (fallback) {
      (data as PostDoc).origin = fallback;
    }
  }

  return data;
};
