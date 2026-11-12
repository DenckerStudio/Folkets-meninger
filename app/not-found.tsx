import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { VURDER_FOCUS_RING } from '@/lib/admin/vurder-interaction-classes';
import { cn } from '@/lib/utils';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <h2 className="text-4xl font-bold text-foreground mb-4">Siden ble ikke funnet</h2>
      <p className="text-lg text-muted-foreground mb-8">
        Vi fant ikke siden du lette etter. Den kan ha blitt flyttet eller slettet.
      </p>
      <Link
        href="/"
        className={cn(
          'inline-flex items-center rounded-xl border border-transparent bg-brand px-6 py-3 text-base font-medium text-brand-foreground transition-colors hover:bg-brand/90',
          VURDER_FOCUS_RING,
        )}
      >
        <ArrowLeft className="mr-2 w-5 h-5" />
        Tilbake til forsiden
      </Link>
    </div>
  );
}
