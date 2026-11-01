import Script from 'next/script';
import { isUmamiEnabled } from '@/lib/analytics/flags';

export function UmamiScript() {
  if (!isUmamiEnabled()) {
    return null;
  }

  const scriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL!.trim();
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID!.trim();

  return (
    <Script
      src={scriptUrl}
      strategy="afterInteractive"
      data-website-id={websiteId}
    />
  );
}
