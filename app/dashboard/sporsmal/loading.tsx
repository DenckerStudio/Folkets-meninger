import { DashboardPage } from '@/components/dashboard/dashboard-page';

export default function SporsmalLoading() {
  return (
    <DashboardPage>
      <div
        aria-busy="true"
        aria-live="polite"
        role="status"
        aria-label="Laster spørsmål"
        className="contents"
      >
        <div className="space-y-2">
          <div className="h-8 max-w-xs animate-pulse rounded-lg bg-muted" />
          <div className="h-5 max-w-2xl animate-pulse rounded-lg bg-muted/80" />
        </div>
        <div className="h-10 max-w-xl animate-pulse rounded-xl bg-muted/50" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-muted/30" />
          ))}
        </div>
      </div>
    </DashboardPage>
  );
}