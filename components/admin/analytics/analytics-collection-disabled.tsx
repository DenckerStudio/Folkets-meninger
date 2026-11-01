import {
  ANALYTICS_COLLECTION_DISABLED_BODY,
  ANALYTICS_COLLECTION_DISABLED_TITLE,
} from '@/lib/analytics/collection-notice';

export function AnalyticsCollectionDisabled() {
  return (
    <div
      className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground"
      role="status"
    >
      <p className="font-medium">{ANALYTICS_COLLECTION_DISABLED_TITLE}</p>
      <p className="mt-2 text-muted-foreground">{ANALYTICS_COLLECTION_DISABLED_BODY}</p>
    </div>
  );
}
