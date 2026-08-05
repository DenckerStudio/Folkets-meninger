export default function UtforskLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 bg-muted rounded w-48" />
      <div className="h-12 bg-muted rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 bg-muted rounded-xl" />
        ))}
      </div>
    </div>
  );
}
