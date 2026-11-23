import type { MarkLinkedDraftPrReadyResult } from '@/lib/admin/local-ai-hub/approve-pr-ready-result';

export type LocalAiApproveHubNotice = {
  variant: 'success' | 'warning';
  title: string;
  body: string;
  pullNumber?: number;
  pullUrl?: string;
  taskId: number;
  canRetryReady?: boolean;
};

export const LOCAL_AI_HUB_NOTICE_STORAGE_KEY = 'fm-local-ai-hub-approve-notice';

export function buildApproveHubNotice(
  taskId: number,
  prReady: MarkLinkedDraftPrReadyResult,
): LocalAiApproveHubNotice | null {
  if (prReady.ok) {
    const { number, url } = prReady.pull;
    if (prReady.commentFailed) {
      return {
        variant: 'warning',
        title: 'Advarsel',
        body: `Godkjent – PR #${number} er satt til ready, men hub-kommentaren ble ikke lagt inn.`,
        pullNumber: number,
        pullUrl: url,
        taskId,
        canRetryReady: false,
      };
    }
    return {
      variant: 'success',
      title: 'Godkjent',
      body: `Godkjent – PR #${number} satt til ready`,
      pullNumber: number,
      pullUrl: url,
      taskId,
    };
  }

  if ('skipped' in prReady && prReady.skipped) {
    return null;
  }

  if ('readyFailed' in prReady && prReady.readyFailed) {
    const { number, url } = prReady.pull;
    return {
      variant: 'warning',
      title: 'Advarsel',
      body: `Godkjent, men PR #${number} kunne ikke settes til ready. Åpne PR-en på GitHub og sett den til ready manuelt, eller prøv igjen her.`,
      pullNumber: number,
      pullUrl: url,
      taskId,
      canRetryReady: true,
    };
  }

  if ('error' in prReady) {
    return {
      variant: 'warning',
      title: 'Advarsel',
      body:
        'Godkjent, men vi fant ikke eller kunne ikke oppdatere PR-en. Sett den til ready manuelt på GitHub om den fortsatt er draft.',
      taskId,
      canRetryReady: true,
    };
  }

  return null;
}

export function serializeHubNotice(notice: LocalAiApproveHubNotice): string {
  return JSON.stringify(notice);
}

export function parseStoredHubNotice(raw: string | null): LocalAiApproveHubNotice | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LocalAiApproveHubNotice;
    if (
      parsed &&
      (parsed.variant === 'success' || parsed.variant === 'warning') &&
      typeof parsed.body === 'string' &&
      typeof parsed.taskId === 'number'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** Lagrer og leser hub-varsel — brukes i klient og tester med injisert storage. */
export function writeHubNoticeToStorage(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  notice: LocalAiApproveHubNotice | null,
): void {
  if (!notice) {
    storage.removeItem(LOCAL_AI_HUB_NOTICE_STORAGE_KEY);
    return;
  }
  storage.setItem(LOCAL_AI_HUB_NOTICE_STORAGE_KEY, serializeHubNotice(notice));
}

export function readHubNoticeFromStorage(
  storage: Pick<Storage, 'getItem'>,
): LocalAiApproveHubNotice | null {
  return parseStoredHubNotice(storage.getItem(LOCAL_AI_HUB_NOTICE_STORAGE_KEY));
}