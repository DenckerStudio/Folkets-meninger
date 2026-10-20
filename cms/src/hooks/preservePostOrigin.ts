import type { CollectionBeforeChangeHook } from 'payload';

type PostDoc = { id?: string | number; origin?: string };

/** `origin` is immutable after create (main doc is source of truth). */
export const preservePostOrigin: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
  operation,
}) => {
  if (operation !== 'update' || !data || typeof data !== 'object') {
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
