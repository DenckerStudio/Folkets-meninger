'use client';

import { usePathname, useRouter } from 'next/navigation';
import { BloggStatusPanel } from '@/components/blog/blogg-status-panel';
import { getBloggSecondaryAction } from '@/lib/blog/blogg-secondary-action';

export function BlogCmsUnavailable() {
  const router = useRouter();
  const pathname = usePathname();
  const secondary = getBloggSecondaryAction(pathname);

  return (
    <BloggStatusPanel
      title="Bloggen er midlertidig utilgjengelig"
      description="Vi klarte ikke å hente artikler fra redaksjonssystemet akkurat nå. Prøv igjen om litt."
      onRetry={() => {
        router.refresh();
      }}
      secondaryHref={secondary.href}
      secondaryLabel={secondary.label}
    />
  );
}
