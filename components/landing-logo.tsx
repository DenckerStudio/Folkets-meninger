import { cn } from '@/lib/utils';

type LandingLogoProps = {
  className?: string;
  /** Unique clipPath id when multiple logos render on the same page. */
  clipId?: string;
};

export function LandingLogo({ className, clipId = 'fs-landing-bubble' }: LandingLogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 200 250" className="h-10 w-8 shrink-0" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <clipPath id={clipId}>
          <path d="M 40 0 H 160 A 40 40 0 0 1 200 40 V 160 A 40 40 0 0 1 160 200 H 140 L 145 240 L 100 200 H 40 A 40 40 0 0 1 0 160 V 40 A 40 40 0 0 1 40 0 Z" />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          <rect width="200" height="250" fill="#ba0c2f" />
          <rect x="60" y="0" width="30" height="250" fill="white" />
          <rect x="0" y="80" width="200" height="30" fill="white" />
          <rect x="70" y="0" width="10" height="250" fill="#00205b" />
          <rect x="0" y="90" width="200" height="10" fill="#00205b" />
          <path d="M 0 150 L 90 60 L 120 90 L 220 -10 L 220 250 L 0 250 Z" fill="#ba0c2f" />
          <path
            d="M -10 160 L 90 60 L 120 90 L 230 -20"
            fill="none"
            stroke="white"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="120" cy="90" r="14" fill="#00205b" stroke="white" strokeWidth="6" />
        </g>
      </svg>
      <div className="flex flex-col justify-center font-extrabold tracking-tight">
        <span className="text-[0.65rem] leading-none text-[#00205b] sm:text-sm">FOLKETS</span>
        <span className="text-[0.65rem] leading-none text-[#ba0c2f] sm:text-sm">STEMME</span>
      </div>
    </div>
  );
}
