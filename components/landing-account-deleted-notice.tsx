'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { ACCOUNT_DELETED_LANDING_MESSAGE, ACCOUNT_DELETED_QUERY_PARAM } from '@/lib/account-delete/constants';
import { VURDER_FOCUS_RING } from '@/lib/admin/vurder-interaction-classes';
import { cn } from '@/lib/utils';

export function LandingAccountDeletedNotice() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || searchParams.get(ACCOUNT_DELETED_QUERY_PARAM) !== '1') {
    return null;
  }

  const dismiss = () => {
    setDismissed(true);
    const next = new URLSearchParams(searchParams.toString());
    next.delete(ACCOUNT_DELETED_QUERY_PARAM);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto max-w-5xl px-4 pt-4 sm:px-6 lg:px-8"
    >
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground sm:gap-3">
        <p className="flex-1 leading-snug">{ACCOUNT_DELETED_LANDING_MESSAGE}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Lukk melding"
          className={cn(
            'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground',
            VURDER_FOCUS_RING,
          )}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}