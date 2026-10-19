'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { routes } from '@/lib/routes';

export default function BloggError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[blogg]', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-[#001433]">Bloggen kunne ikke lastes</h1>
      <p className="mt-3 text-sm leading-relaxed text-[#001433]/70">
        Det oppstod en feil ved henting av artikler. Prøv igjen, eller gå tilbake til bloggforsiden.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button type="button" onClick={reset}>
          Prøv igjen
        </Button>
        <Button variant="outline" render={<Link href={routes.blogg} />}>
          Til bloggforsiden
        </Button>
      </div>
    </div>
  );
}
