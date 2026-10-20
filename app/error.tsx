'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { routes } from '@/lib/routes';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app]', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Noe gikk galt</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Vi kunne ikke fullføre forespørselen. Prøv igjen, eller gå tilbake til utforsk.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button type="button" onClick={reset}>
          Prøv igjen
        </Button>
        <Button variant="outline" render={<Link href={routes.utforsk} />}>
          Gå til utforsk
        </Button>
      </div>
    </div>
  );
}
