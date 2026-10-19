import type { CollectionBeforeChangeHook } from 'payload';
import { APIError } from 'payload';
import { isEditor, isReader } from '@/access/roles';
import {
  applyNonEditorDraftConstraints,
  isNonEditorContentWriter,
} from '@/hooks/nonEditorDraftEnforcement';

export const agentDraftGuard: CollectionBeforeChangeHook = ({ data, req }) => {
  if (!req.user) return data;
  const user = req.user as { role?: string } | null;
  if (isReader(user)) {
    throw new APIError('Leser-nøkkel kan ikke opprette eller endre innlegg', 403);
  }
  if (isEditor(user)) return data;
  if (!isNonEditorContentWriter(req)) return data;

  if (!data || typeof data !== 'object') return data;
  return applyNonEditorDraftConstraints(data as Record<string, unknown>);
};
