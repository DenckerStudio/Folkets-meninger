import type { AdminBulkItemResult, AdminBulkSkipReason } from '@/lib/admin/users/types';

const REASON_LABELS: Record<AdminBulkSkipReason, string> = {
  self: 'egen konto',
  last_admin: 'siste administrator',
  stripe_subscription: 'aktivt Stemme+',
  not_found: 'ikke funnet',
  invalid: 'feilet',
};

function skipReasonLabel(result: AdminBulkItemResult): string {
  if (result.reason && REASON_LABELS[result.reason]) {
    return REASON_LABELS[result.reason];
  }
  return 'feilet';
}

export type AdminBulkResultSummary = {
  message: string;
  variant: 'success' | 'error';
  completed: number;
  skipped: number;
};

/** User-facing summary: «X fullført, Y hoppet over (grunn: N, …)». */
export function formatAdminBulkResultSummary(
  results: AdminBulkItemResult[],
): AdminBulkResultSummary {
  const completed = results.filter((r) => r.ok).length;
  const skippedResults = results.filter((r) => !r.ok);
  const skipped = skippedResults.length;

  if (skipped === 0) {
    return {
      message: `${completed} fullført`,
      variant: 'success',
      completed,
      skipped: 0,
    };
  }

  const counts = new Map<string, number>();
  for (const row of skippedResults) {
    const label = skipReasonLabel(row);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const reasonParts = [...counts.entries()]
    .map(([label, count]) => (count > 1 ? `${label}: ${count}` : label))
    .join('; ');

  const message = `${completed} fullført, ${skipped} hoppet over (${reasonParts})`;

  return {
    message,
    variant: completed > 0 ? 'success' : 'error',
    completed,
    skipped,
  };
}
