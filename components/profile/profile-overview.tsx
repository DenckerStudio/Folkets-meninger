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
          Bruk profilmenyen for å åpne stemmehistorikk, innstillinger, preferanser og mer. På mobil
          finner du den nederst til høyre.
        </p>
      </div>

      {showAdminLink ? (
        <Link
          href={routes.admin}
          className={cn(
            'inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm font-medium text-foreground transition-colors',
            'hover:border-brand/40 hover:bg-muted/50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
          )}
        >
          <Shield className="h-4 w-4 text-brand" aria-hidden />
          Åpne admin-hub
        </Link>
      ) : null}
    </div>
  );
}
