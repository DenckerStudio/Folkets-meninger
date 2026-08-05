import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <h2 className="text-4xl font-bold text-foreground mb-4">Siden ble ikke funnet</h2>
      <p className="text-lg text-muted-foreground mb-8">
        Vi kunne ikke finne siden du lette etter. Den kan ha blitt flyttet eller slettet.
      </p>
      <Link 
        href="/" 
        className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
      >
        <ArrowLeft className="mr-2 w-5 h-5" />
        Tilbake til forsiden
      </Link>
    </div>
  );
}
