'use client';

import { useState } from 'react';
import { ChevronDown, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ForumMobileRules() {
  const [open, setOpen] = useState(false);

  return (
    <div className="xl:hidden mb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-600" />
          Forumregler
        </span>
        <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul className="mt-2 rounded-xl border border-gray-200 bg-white p-4 space-y-2 text-xs text-gray-600">
          <li>Innlegg er offentlige og viser ditt navn (fornavn og etternavn).</li>
          <li>Hold en saklig og respektfull tone.</li>
          <li>Ingen hat, trakassering, porno eller spam.</li>
          <li>Du må være logget inn for å skrive.</li>
        </ul>
      )}
    </div>
  );
}
