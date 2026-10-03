'use client';

import { useRef } from 'react';
import { gsap, registerGsap, ScrollTrigger, useGSAP } from '@/lib/gsap-client';

const TICK_COUNT = 6;

export function LandingExperience({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const spineRef = useRef<SVGSVGElement>(null);
  registerGsap();

  useGSAP(
    () => {
      const root = rootRef.current;
      const spine = spineRef.current;
      if (!root || !spine) return;

      const mm = gsap.matchMedia();
      mm.add(
        {
          reduceMotion: '(prefers-reduced-motion: reduce)',
          motionOk: '(prefers-reduced-motion: no-preference)',
        },
        (context) => {
          const reduce = Boolean(context.conditions?.reduceMotion);
          const sections = gsap.utils.toArray<HTMLElement>('[data-landing-section]', root);
          const rules = gsap.utils.toArray<HTMLElement>('.landing-heading-rule', root);
          const line = spine.querySelector<SVGLineElement>('.landing-spine-line');
          const ticks = gsap.utils.toArray<SVGLineElement>('.landing-spine-tick', spine);

          const layoutSpine = () => {
            if (!line) return;
            const logo = document.querySelector<HTMLElement>('[data-landing-logo]');
            const last = sections[sections.length - 1];
            if (!last) return;
            const rootRect = root.getBoundingClientRect();
            const lastRect = last.getBoundingClientRect();
            const logoRect = logo?.getBoundingClientRect();
            const x = logoRect
              ? logoRect.left + logoRect.width / 2 - rootRect.left
              : 18;
            const y1 = logoRect ? logoRect.bottom - rootRect.top + 4 : 0;
            const y2 = lastRect.bottom - rootRect.top;
            spine.setAttribute('viewBox', `0 0 ${Math.max(root.offsetWidth, 1)} ${Math.max(root.offsetHeight, 1)}`);
            spine.style.height = `${root.offsetHeight}px`;
            line.setAttribute('x1', String(x));
            line.setAttribute('x2', String(x));
            line.setAttribute('y1', String(y1));
            line.setAttribute('y2', String(y2));
            sections.forEach((section, index) => {
              const tick = ticks[index];
              if (!tick) return;
              const top = section.getBoundingClientRect().top - rootRect.top + 10;
              tick.setAttribute('x1', String(x));
              tick.setAttribute('x2', String(x + 11));
              tick.setAttribute('y1', String(top));
              tick.setAttribute('y2', String(top));
            });
            if (line.getTotalLength() > 0) {
              const length = line.getTotalLength();
              line.setAttribute('stroke-dasharray', String(length));
              if (reduce) line.setAttribute('stroke-dashoffset', '0');
            }
          };

          layoutSpine();

          if (reduce) {
            gsap.set(sections, { autoAlpha: 1, y: 0, clearProps: 'none' });
            gsap.set(rules, { scaleX: 1 });
            gsap.set(ticks, { autoAlpha: 1, scaleX: 1 });
            return;
          }

          gsap.set(sections, { autoAlpha: 0, y: 26 });
          gsap.set(rules, { scaleX: 0 });
          gsap.set(ticks, { autoAlpha: 0, scaleX: 0, transformOrigin: 'left center' });

          sections.forEach((section, index) => {
            gsap.to(section, {
              autoAlpha: 1,
              y: 0,
              duration: 0.7,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: section,
                start: 'top 86%',
                toggleActions: 'play none none reverse',
              },
            });
            const tick = ticks[index];
            if (tick) {
              gsap.to(tick, {
                autoAlpha: 1,
                scaleX: 1,
                duration: 0.35,
                ease: 'power2.out',
                scrollTrigger: {
                  trigger: section,
                  start: 'top 86%',
                  toggleActions: 'play none none reverse',
                },
              });
            }
          });

          rules.forEach((rule) => {
            gsap.to(rule, {
              scaleX: 1,
              duration: 0.45,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: rule,
                start: 'top 88%',
                toggleActions: 'play none none reverse',
              },
            });
          });

          if (line) {
            const length = line.getTotalLength();
            gsap.set(line, { strokeDasharray: length, strokeDashoffset: length });
            gsap.to(line, {
              strokeDashoffset: 0,
              ease: 'none',
              scrollTrigger: {
                trigger: root,
                start: 'top 80%',
                end: 'bottom bottom',
                scrub: 0.45,
              },
            });
          }

          const onRefresh = () => layoutSpine();
          ScrollTrigger.addEventListener('refreshInit', onRefresh);
          window.addEventListener('resize', onRefresh);
          return () => {
            ScrollTrigger.removeEventListener('refreshInit', onRefresh);
            window.removeEventListener('resize', onRefresh);
          };
        },
      );

      return () => mm.revert();
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="relative">
      <svg
        ref={spineRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-20 w-full overflow-visible"
        aria-hidden
      >
        <line className="landing-spine-line" stroke="#00205b" strokeWidth="1.2" strokeLinecap="round" />
        {Array.from({ length: TICK_COUNT }, (_, index) => (
          <line key={index} className="landing-spine-tick" stroke="#ba0c2f" strokeWidth="2.2" strokeLinecap="round" />
        ))}
      </svg>
      {children}
    </div>
  );
}
