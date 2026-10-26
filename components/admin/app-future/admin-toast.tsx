'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function useAdminToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [variant, setVariant] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4200);
    return () => window.clearTimeout(timer);
  }, [message]);

  const toast = (text: string, nextVariant: 'success' | 'error' = 'success') => {
    setVariant(nextVariant);
    setMessage(text);
  };

  return { message, variant, toast, clear: () => setMessage(null) };
}

export function AdminToast({
  message,
  variant,
}: {
  message: string | null;
  variant: 'success' | 'error';
}) {
  if (!message) return null;
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-none fixed bottom-4 left-1/2 z-[80] max-w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg',
        variant === 'success'
          ? 'border-border bg-card text-foreground'
          : 'border-destructive/40 bg-destructive/10 text-destructive',
      )}
    >
      {message}
    </div>
  );
}
