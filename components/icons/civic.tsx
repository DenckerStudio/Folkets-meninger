import { cn } from '@/lib/utils';

export type CivicIconProps = {
  className?: string;
};

function CivicSvg({ className, children }: CivicIconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('civic-icon h-[1em] w-[1em] shrink-0', className)}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Speech bubble — system-generated copy, Reels, AI-sammendrag. */
export function CivicBubble({ className }: CivicIconProps) {
  return (
    <CivicSvg className={className}>
      <path
        className="civic-draw"
        d="M5.5 5.25h13A2.25 2.25 0 0 1 20.75 7.5v7A2.25 2.25 0 0 1 18.5 16.75h-4.2L9.8 19.7a.6.6 0 0 1-.95-.48v-2.47H5.5A2.25 2.25 0 0 1 3.25 14.5v-7A2.25 2.25 0 0 1 5.5 5.25Z"
        pathLength={1}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        className="civic-draw civic-draw-delay"
        d="M7.75 10.25h8.5M7.75 13h5.5"
        pathLength={1}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </CivicSvg>
  );
}

/** Ballot with a check — kunnskapstest and civic actions. */
export function CivicBallot({ className }: CivicIconProps) {
  return (
    <CivicSvg className={className}>
      <rect
        className="civic-draw"
        x="5.25"
        y="3.5"
        width="13.5"
        height="17"
        rx="2"
        pathLength={1}
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        className="civic-draw civic-draw-delay"
        d="M8.5 12.1 11 14.5l4.6-5.2"
        pathLength={1}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </CivicSvg>
  );
}

/** Quiet heart pulse — Stemme+ support, not a star. */
export function CivicHeart({ className }: CivicIconProps) {
  return (
    <CivicSvg className={className}>
      <path
        className="civic-pulse"
        d="M12 19.15s-6.4-3.7-6.4-8.05A3.55 3.55 0 0 1 12 8.2a3.55 3.55 0 0 1 6.4 2.9c0 4.35-6.4 8.05-6.4 8.05Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </CivicSvg>
  );
}

/** Concentric voice rings — motion preference. */
export function CivicRings({ className }: CivicIconProps) {
  return (
    <CivicSvg className={className}>
      <circle cx="12" cy="12" r="2.1" fill="currentColor" className="civic-pulse" />
      <circle
        className="civic-ring"
        cx="12"
        cy="12"
        r="5.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle
        className="civic-ring civic-ring-delay"
        cx="12"
        cy="12"
        r="8.2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </CivicSvg>
  );
}

/** Short check for benefit lists. */
export function CivicTick({ className }: CivicIconProps) {
  return (
    <CivicSvg className={className}>
      <path
        className="civic-draw"
        d="M5.5 12.2 10 16.4 18.5 7.6"
        pathLength={1}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </CivicSvg>
  );
}
