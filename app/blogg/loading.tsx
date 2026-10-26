export default function BloggLoading() {
  return (
    <div aria-busy="true" aria-label="Laster blogg" className="mx-auto max-w-3xl space-y-6 px-4">
      <div className="h-10 max-w-md animate-pulse rounded-lg bg-[#001433]/10" />
      <div className="h-5 max-w-xl animate-pulse rounded-lg bg-[#001433]/8" />
      <div className="space-y-4 pt-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl border border-[#001433]/10 bg-white/60" />
        ))}
      </div>
    </div>
  );
}
