export default function SakEmbedLoading() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Henter saken…</p>
      <div className="h-5 w-32 animate-pulse rounded-full bg-muted" />
      <div className="h-7 w-3/4 animate-pulse rounded-lg bg-muted" />
      <div className="h-4 w-1/2 animate-pulse rounded-lg bg-muted" />
      <div className="h-24 w-full animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
