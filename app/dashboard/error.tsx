'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { routes } from '@/lib/routes';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard]', error);
  }, [error]);

  return (
    <div className="max-w-lg mx-auto py-16 px-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">Noe gikk galt</h1>
      <p className="text-muted-foreground mb-6">
        Vi kunne ikke laste denne siden. Prøv igjen, eller gå tilbake til utforsk.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
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
