import type { ValgomatPayload } from '@/lib/valgomat/types';

export const VALGOMAT_CONSENT_ERROR_CODE = 'POLITICAL_CONSENT_REQUIRED' as const;

export type ValgomatApiErrorBody = {
  error?: string;
  code?: string;
  purpose?: string;
};

export type ParsedValgomatResponse =
  | { kind: 'success'; data: ValgomatPayload }
  | { kind: 'consent_required' }
  | { kind: 'error'; message: string };

export function parseValgomatApiResponse(
  status: number,
  body: ValgomatApiErrorBody & Partial<ValgomatPayload>,
): ParsedValgomatResponse {
  if (status === 403 && body.code === VALGOMAT_CONSENT_ERROR_CODE) {
    return { kind: 'consent_required' };
  }
  if (!status || status < 200 || status >= 300) {
    return {
      kind: 'error',
      message: typeof body.error === 'string' ? body.error : 'Kunne ikke laste Valgomat',
    };
  }
  return { kind: 'success', data: body as ValgomatPayload };
}