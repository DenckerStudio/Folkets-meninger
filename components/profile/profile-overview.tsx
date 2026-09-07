'use client';

import Link from 'next/link';
import { Shield } from 'lucide-react';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { PROFILE_TABS } from '@/components/profile/profile-tabs';

type ProfileOverviewProps = {
  showAdminLink?: boolean;
};

export function ProfileOverview({ showAdminLink = false }: ProfileOverviewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Oversikt</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Velg hva du vil se eller endre på profilen din.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PROFILE_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={`${routes.minSide}?tab=${tab.id}`}
              className={cn(
                'flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-colors',
                'hover:border-brand/40 hover:bg-muted/30',
              )}
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground">{tab.label}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{tab.description}</p>
                </div>
              </div>
              <span className="mt-4 text-sm font-medium text-brand">Åpne →</span>
            </Link>
          );
        })}

        {showAdminLink ? (
          <Link
            href={routes.admin}
            className={cn(
              'flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-colors',
              'hover:border-brand/40 hover:bg-muted/30',
            )}
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Shield className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground">Admin-hub</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Verktøy for statistikk og drift.
                </p>
              </div>
            </div>
            <span className="mt-4 text-sm font-medium text-brand">Åpne →</span>
          </Link>
        ) : null}
      </div>
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
