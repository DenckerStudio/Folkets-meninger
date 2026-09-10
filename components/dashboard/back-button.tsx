'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type BackButtonProps = {
  /** Used when there is no in-app history (direct link, new tab). */
  fallbackHref: string;
  label?: string;
  className?: string;
};

export function BackButton({
  fallbackHref,
  label = 'Tilbake',
  className,
}: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center text-sm font-medium text-brand hover:text-brand/80',
        className,
      )}
    >
      <ArrowLeft className="mr-2 h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}
