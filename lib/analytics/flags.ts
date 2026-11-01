export function isAnalyticsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true';
}

export function isUmamiEnabled(): boolean {
  return (
    isAnalyticsEnabled() &&
    Boolean(process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL?.trim())
  );
}
