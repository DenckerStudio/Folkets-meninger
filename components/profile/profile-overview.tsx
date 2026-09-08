'use client';

import Link from 'next/link';
import { Shield } from 'lucide-react';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type ProfileOverviewProps = {
  showAdminLink?: boolean;
};

export function ProfileOverview({ showAdminLink = false }: ProfileOverviewProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Oversikt</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bruk profilmenyen øverst til høyre for å åpne stemmehistorikk, innstillinger, varsler og
          mer.
        </p>
      </div>

      {showAdminLink ? (
        <Link
          href={routes.admin}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm font-medium text-foreground transition-colors',
            'hover:border-brand/40 hover:bg-muted/50',
          )}
        >
          <Shield className="h-4 w-4 text-brand" aria-hidden />
          Åpne admin-hub
        </Link>
      ) : null}
    </div>
  );
}

export function ProfileBackLink() {
  return (
    <Link href={routes.minSide} className="inline-flex text-sm font-medium text-brand hover:underline">
      ← Tilbake til oversikt
    </Link>
  );
}
