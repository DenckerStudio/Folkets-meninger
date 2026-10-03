'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { gsap, registerGsap, useGSAP } from '@/lib/gsap-client';

type LandingLogoProps = {
  className?: string;
  /** Unique clipPath id when multiple logos render on the same page. */
  clipId?: string;
  /** Play the flag draw-on + quiet voice ring. */
  animate?: boolean;
};

const BUBBLE_D =
  'M 40 0 H 160 A 40 40 0 0 1 200 40 V 160 A 40 40 0 0 1 160 200 H 140 L 145 240 L 100 200 H 40 A 40 40 0 0 1 0 160 V 40 A 40 40 0 0 1 40 0 Z';

export function LandingLogo({ className, clipId = 'fs-landing-bubble', animate = false }: LandingLogoProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  registerGsap();

  useGSAP(
    () => {
      if (!animate) return;

      const mm = gsap.matchMedia();
      mm.add(
        {
          reduceMotion: '(prefers-reduced-motion: reduce)',
          motionOk: '(prefers-reduced-motion: no-preference)',
        },
        (context) => {
          const reduce = Boolean(context.conditions?.reduceMotion);
          const outline = '.logo-outline';
          const field = '.logo-field';
          const whiteCross = '.logo-white';
          const navyCross = '.logo-navy';
          const diagonal = '.logo-diagonal';
          const slash = '.logo-slash';
          const dot = '.logo-dot';
          const ring = '.logo-voice-ring';
          const folkets = '.logo-word-folkets';
          const stemme = '.logo-word-stemme';

          if (reduce) {
            gsap.set([outline, field, whiteCross, navyCross, diagonal, slash, dot, folkets, stemme], {
              autoAlpha: 1,
              strokeDashoffset: 0,
            });
            gsap.set(ring, { autoAlpha: 0, scale: 1 });
            return;
          }

          gsap.set(outline, { strokeDasharray: 1, strokeDashoffset: 1, autoAlpha: 1 });
          gsap.set([field, whiteCross, navyCross, diagonal, slash, dot], { autoAlpha: 0 });
          gsap.set(ring, { autoAlpha: 0, scale: 1, svgOrigin: '120 90' });
          gsap.set([folkets, stemme], { autoAlpha: 0, y: 4 });

          const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
          tl.to(outline, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' })
            .to(field, { autoAlpha: 1, duration: 0.28 }, '-=0.08')
            .to(outline, { autoAlpha: 0, duration: 0.2 }, '<')
            .to(whiteCross, { autoAlpha: 1, duration: 0.22 }, '-=0.04')
            .to(navyCross, { autoAlpha: 1, duration: 0.22 })
            .to([diagonal, slash], { autoAlpha: 1, duration: 0.28 }, '-=0.02')
            .to(dot, { autoAlpha: 1, duration: 0.2 })
            .to(folkets, { autoAlpha: 1, y: 0, duration: 0.28 }, '-=0.04')
            .to(stemme, { autoAlpha: 1, y: 0, duration: 0.28 }, '-=0.12')
            .add(() => {
              gsap.fromTo(
                ring,
                { autoAlpha: 0.42, scale: 1 },
                {
                  autoAlpha: 0,
                  scale: 2.55,
                  duration: 1.7,
                  ease: 'power1.out',
                  repeat: -1,
                  repeatDelay: 3.2,
                },
              );
            });
        },
      );

      return () => mm.revert();
    },
    { scope: rootRef, dependencies: [animate] },
  );

  return (
    <div
      ref={rootRef}
      data-landing-logo={animate ? 'header' : undefined}
      className={cn('flex items-center gap-2.5', className)}
    >
      <svg viewBox="0 0 200 250" className="h-10 w-8 shrink-0 overflow-visible" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <clipPath id={clipId}>
          <path d={BUBBLE_D} />
        </clipPath>
        <path
          className="logo-outline"
          d={BUBBLE_D}
          fill="none"
          stroke="#00205b"
          strokeWidth="6"
          strokeLinejoin="round"
          pathLength={1}
          opacity={animate ? 1 : 0}
        />
        <g clipPath={`url(#${clipId})`}>
          <rect className="logo-field" width="200" height="250" fill="#ba0c2f" opacity={animate ? 0 : 1} />
          <rect className="logo-white" x="60" y="0" width="30" height="250" fill="white" opacity={animate ? 0 : 1} />
          <rect className="logo-white" x="0" y="80" width="200" height="30" fill="white" opacity={animate ? 0 : 1} />
          <rect className="logo-navy" x="70" y="0" width="10" height="250" fill="#00205b" opacity={animate ? 0 : 1} />
          <rect className="logo-navy" x="0" y="90" width="200" height="10" fill="#00205b" opacity={animate ? 0 : 1} />
          <path className="logo-diagonal" d="M 0 150 L 90 60 L 120 90 L 220 -10 L 220 250 L 0 250 Z" fill="#ba0c2f" opacity={animate ? 0 : 1} />
          <path
            className="logo-slash"
            d="M -10 160 L 90 60 L 120 90 L 230 -20"
            fill="none"
            stroke="white"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={animate ? 0 : 1}
          />
          <circle className="logo-dot" cx="120" cy="90" r="14" fill="#00205b" stroke="white" strokeWidth="6" opacity={animate ? 0 : 1} />
        </g>
        <circle
          className="logo-voice-ring"
          cx="120"
          cy="90"
          r="18"
          fill="none"
          stroke="#00205b"
          strokeWidth="3"
          opacity={0}
        />
      </svg>
      <div className="flex flex-col justify-center font-extrabold tracking-tight">
        <span className="logo-word-folkets text-[0.65rem] leading-none text-[#00205b] sm:text-sm" style={animate ? { opacity: 0 } : undefined}>
          FOLKETS
        </span>
        <span className="logo-word-stemme text-[0.65rem] leading-none text-[#ba0c2f] sm:text-sm" style={animate ? { opacity: 0 } : undefined}>
          STEMME
        </span>
      </div>
    </div>
  );
}
