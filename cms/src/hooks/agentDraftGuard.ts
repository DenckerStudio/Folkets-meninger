import type { CollectionBeforeChangeHook } from 'payload';
import { isAgent, isEditor } from '@/access/roles';

export const agentDraftGuard: CollectionBeforeChangeHook = ({ data, req }) => {
  if (!req.user) return data;
  const user = req.user as { role?: string } | null;
  if (isEditor(user)) return data;
  if (!isAgent(user)) return data;

  data._status = 'draft';
  if (data.review && typeof data.review === 'object') {
    data.review = { ...data.review, state: 'ny' };
  }
  return data;
};
