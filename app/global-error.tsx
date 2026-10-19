'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global]', error);
  }, [error]);

  return (
    <html lang="nb">
      <body className="min-h-screen bg-[#f7f8fb] font-sans text-[#001433] antialiased">
        <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Noe gikk galt</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#001433]/70">
            En uventet feil oppstod. Prøv å laste siden på nytt.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-[#00205b] px-5 text-sm font-semibold text-white hover:bg-[#00205b]/90"
          >
            Prøv igjen
          </button>
        </div>
      </body>
    </html>
  );
}
