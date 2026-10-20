'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BloggStatusPanel } from '@/components/blog/blogg-status-panel';
import { getBloggSecondaryAction } from '@/lib/blog/blogg-secondary-action';

export default function BloggError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const secondary = getBloggSecondaryAction(pathname);

  useEffect(() => {
    console.error('[blogg]', error);
  }, [error]);

  return (
    <BloggStatusPanel
      title="Bloggen kunne ikke lastes"
      description="Det oppstod en feil ved henting av artikler. Prøv igjen, eller gå videre."
      onRetry={() => {
        reset();
        router.refresh();
      }}
      secondaryHref={secondary.href}
      secondaryLabel={secondary.label}
    />
  );
}
