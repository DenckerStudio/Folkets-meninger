export function PolitikerStemmerLoading() {
  return (
    <section
      className="rounded-2xl border border-border bg-card p-4 sm:p-6"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm text-muted-foreground">Laster stemmer og folkemening…</p>
      <div className="mt-4 space-y-3 animate-pulse">
        <div className="h-16 rounded-xl bg-muted" />
        <div className="h-28 rounded-xl bg-muted" />
        <div className="h-28 rounded-xl bg-muted" />
      </div>
    </section>
  );
}