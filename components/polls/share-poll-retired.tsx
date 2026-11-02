import Link from 'next/link';
import { PollRetiredNotice } from '@/components/polls/poll-retired-notice';

export function SharePollRetiredPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="text-lg font-extrabold tracking-tight text-brand">Folkets</span>
          <span className="text-lg font-extrabold tracking-tight text-brand-accent">Meninger</span>
        </Link>
      </header>

      <PollRetiredNotice />
    </div>
  );
}
