import type { CollectionAfterReadHook } from 'payload';
import { isEditor, type UserLike } from '@/access/roles';

/** Hide e-mail from API responses for agent/reader keys (editors need it in admin). */
export const stripUserEmailForNonEditors: CollectionAfterReadHook = ({ doc, req }) => {
  if (isEditor(req.user as UserLike)) return doc;
  if (!doc || typeof doc !== 'object') return doc;
  if (!('email' in doc)) return doc;
  const { email: _omit, ...rest } = doc as { email?: string };
  return rest;
};
