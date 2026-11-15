export function TopicAroundSakSectionSkeleton() {
  return (
    <section
      className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6"
      aria-hidden
    >
      <div className="h-6 w-48 animate-pulse rounded-md bg-muted" />
      <div className="mt-3 h-4 w-full max-w-lg animate-pulse rounded-md bg-muted/80" />
      <div className="mt-6 space-y-3">
        <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
        <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
      </div>
    </section>
  );
}