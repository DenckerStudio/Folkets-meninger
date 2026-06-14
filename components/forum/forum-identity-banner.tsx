import { UserCircle } from 'lucide-react';

export function ForumIdentityBanner() {
  return (
    <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/80 p-4 flex gap-3">
      <UserCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
      <div className="text-sm text-indigo-950">
        <p className="font-semibold">Forumet er ikke anonymt</p>
        <p className="mt-1 text-indigo-900/90">
          Innlegg er offentlige og viser fornavn og etternavn. Stemmegivning på saker forblir anonym i
          statistikken.
        </p>
      </div>
    </div>
  );
}
