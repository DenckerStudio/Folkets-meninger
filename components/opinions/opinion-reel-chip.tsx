import { useRouter } from 'next/navigation';
import { Vote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/routes';

/** Links an opinion back to its Stortinget-issue Reel, when one is live (B4). */
export function OpinionReelChip({
  pollId,
  className,
}: {
  pollId: string | null | undefined;
  className?: string;
}) {
  const router = useRouter();
  if (!pollId) return null;
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    router.push(routes.utforskReels(pollId));
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand transition-colors hover:bg-brand/15',
        className,
      )}
    >
      <Vote className="h-3.5 w-3.5" />
      Stem på dette i Reels
    </button>
  );
}
