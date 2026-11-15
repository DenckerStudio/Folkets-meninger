import { DashboardPage } from '@/components/dashboard/dashboard-page';

export default function InnsiktLoading() {
  return (
    <DashboardPage>
      <div aria-busy="true" aria-label="Laster innsikt" className="contents">
        <div className="space-y-2">
          <div className="h-8 max-w-xs animate-pulse rounded-lg bg-muted" />
          <div className="h-5 max-w-md animate-pulse rounded-lg bg-muted/80" />
        </div>
        <div className="h-20 animate-pulse rounded-xl border border-border bg-muted/40" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl border border-border bg-muted/30" />
          ))}
        </div>
      </div>
    </DashboardPage>
  );
}