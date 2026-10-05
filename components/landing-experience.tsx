'use client';

import { useRef } from 'react';
import { gsap, registerGsap, useGSAP } from '@/lib/gsap-client';

export function LandingExperience({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  registerGsap();

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

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

          if (reduce) {
            gsap.set(sections, { autoAlpha: 1, y: 0 });
            gsap.set(rules, { scaleX: 1 });
            return;
          }

          gsap.set(sections, { autoAlpha: 1, y: 18 });
          gsap.set(rules, { scaleX: 0 });

          sections.forEach((section) => {
            gsap.to(section, {
              y: 0,
              duration: 0.55,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: section,
                start: 'top 86%',
                toggleActions: 'play none none reverse',
              },
            });
          });

          rules.forEach((rule) => {
            gsap.to(rule, {
              scaleX: 1,
              duration: 0.4,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: rule,
                start: 'top 88%',
                toggleActions: 'play none none reverse',
              },
            });
          });
        },
      );

      return () => mm.revert();
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="relative">
      {children}
    </div>
  );
}
