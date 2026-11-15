'use client';

import { useRouter } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';

export function TopicAroundSakSectionClient({
  issueId,
  initialError,
}: {
  issueId: string;
  initialError: string;
}) {
  const router = useRouter();

  return (
    <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center" role="alert">
      <p className="text-sm text-foreground">{initialError}</p>
      <button
        type="button"
        className={`${buttonVariants()} mt-3`}
        onClick={() => router.refresh()}
        data-issue-id={issueId}
      >
        Prøv igjen
      </button>
    </div>
  );
}