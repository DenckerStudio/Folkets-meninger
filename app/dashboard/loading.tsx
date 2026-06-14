export default function DashboardLoading() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 animate-pulse space-y-6">
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      <div className="h-4 bg-gray-100 rounded w-2/3" />
      <div className="space-y-3">
        <div className="h-24 bg-gray-100 rounded-xl" />
        <div className="h-24 bg-gray-100 rounded-xl" />
        <div className="h-24 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}
