import { DashboardPage } from '@/components/dashboard/dashboard-page';

export default function UtforskLoading() {
  return (
    <DashboardPage>
      <div aria-busy="true" aria-label="Laster Utforsk" className="contents">
      <div className="space-y-2">
        <div className="h-8 max-w-xs animate-pulse rounded-lg bg-muted" />
        <div className="h-5 max-w-md animate-pulse rounded-lg bg-muted/80" />
      </div>
      <div className="h-[5.5rem] animate-pulse rounded-2xl border border-border bg-muted/40" />
      <div className="animate-pulse space-y-4">
        <div className="h-12 rounded-2xl bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
      </div>
    </DashboardPage>
  );
}
