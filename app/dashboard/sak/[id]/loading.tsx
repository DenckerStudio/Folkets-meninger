export default function SakLoading() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-pulse space-y-6">
      <div className="h-10 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-100 rounded w-full" />
      <div className="h-4 bg-gray-100 rounded w-5/6" />
      <div className="grid md:grid-cols-3 gap-4 mt-8">
        <div className="h-32 bg-gray-100 rounded-xl" />
        <div className="h-32 bg-gray-100 rounded-xl" />
        <div className="h-32 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}
