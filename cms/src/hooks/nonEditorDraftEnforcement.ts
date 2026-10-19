import type {
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
  CollectionBeforeValidateHook,
} from 'payload';
import { APIError } from 'payload';
import { canWriteContent, isEditor, isReader, type UserLike } from '@/access/roles';
import type { PayloadRequest } from 'payload';

type DraftableData = Record<string, unknown>;

export function isNonEditorContentWriter(req: PayloadRequest): boolean {
  const user = req.user as UserLike;
  if (!user) return false;
  if (isReader(user)) return false;
  return canWriteContent(user) && !isEditor(user);
}

/** Force draft-only document shape for agent (and other non-editor) API writes. */
export function applyNonEditorDraftConstraints(data: DraftableData): DraftableData {
  data._status = 'draft';
  data.featured = false;
  delete data.publishedAt;
  if (data.review && typeof data.review === 'object') {
    data.review = { ...(data.review as DraftableData), state: 'ny' };
  }
  return data;
}

/**
 * Payload 3 only sets `isSavingDraft` when the REST `draft=true` query flag is set.
 * Body `_status: 'draft'` alone is not enough — publish creates can still persist `published`.
 */
export const enforceDraftQueryForNonEditors: CollectionBeforeOperationHook = ({
  args,
  operation,
  req,
}) => {
  if (operation !== 'create' && operation !== 'update') {
    return args;
  }
  if (!isNonEditorContentWriter(req)) {
    return args;
  }

  return {
    ...args,
    draft: true,
    publishAllLocales: false,
    unpublishAllLocales: false,
  };
};

export const enforceDraftDataBeforeValidate: CollectionBeforeValidateHook = ({ data, req }) => {
  if (!data || typeof data !== 'object') return data;
  if (!isNonEditorContentWriter(req)) return data;

  const record = data as DraftableData;
  if (record._status === 'published') {
    throw new APIError('Agenter kan ikke publisere innlegg via API', 403);
  }
  return applyNonEditorDraftConstraints(record);
};

export const enforceDraftDataBeforeChange: CollectionBeforeChangeHook = ({ data, req }) => {
  if (!data || typeof data !== 'object') return data;
  if (!isNonEditorContentWriter(req)) return data;
  return applyNonEditorDraftConstraints(data as DraftableData);
};
