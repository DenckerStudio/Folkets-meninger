'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  PRODUCT_TOUR_STEPS,
  type ProductTourPlacement,
  type ProductTourStep,
} from '@/lib/onboarding';
import { cn } from '@/lib/utils';

type Rect = { top: number; left: number; width: number; height: number };

type ProductTourProps = {
  onRequestNavOpen: () => void;
  onRequestNavClose: () => void;
  onComplete: () => void;
  onSkip: () => void;
};

const PAD = 8;

export function ProductTour({
  onRequestNavOpen,
  onRequestNavClose,
  onComplete,
  onSkip,
}: ProductTourProps) {
  const [index, setIndex] = useState(0);
  const [target, setTarget] = useState<Rect | null>(null);
  const [popoverSize, setPopoverSize] = useState({ width: 320, height: 200 });
  const step = PRODUCT_TOUR_STEPS[index];

  const measure = useCallback((current: ProductTourStep) => {
    const el = queryVisible(current.selector);
    if (!el) {
      setTarget(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setTarget({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  }, []);

  useLayoutEffect(() => {
    if (step.openNav) onRequestNavOpen();
    else onRequestNavClose();

    const timer = window.setTimeout(() => measure(step), step.openNav ? 280 : 40);
    const onResize = () => measure(step);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [measure, onRequestNavClose, onRequestNavOpen, step]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onSkip]);

  const isLast = index === PRODUCT_TOUR_STEPS.length - 1;
  const popoverPos = positionPopover(target, popoverSize, step.placement);

  const content = (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="product-tour-title">
      <button
        type="button"
        className={target ? 'absolute inset-0 cursor-default bg-transparent' : 'absolute inset-0 cursor-default bg-foreground/55'}
        aria-label="Lukk omvisning"
        onClick={onSkip}
      />
      {target ? (
        <div
        className="pointer-events-none absolute z-[1] rounded-xl border-2 border-brand bg-transparent shadow-[0_0_0_9999px_rgba(11,18,32,0.5)]"
          style={{
            top: target.top - PAD,
            left: target.left - PAD,
            width: target.width + PAD * 2,
            height: target.height + PAD * 2,
          }}
        />
      ) : null}

      <div
        ref={(node) => {
          if (!node) return;
          const next = { width: node.offsetWidth, height: node.offsetHeight };
          if (next.width !== popoverSize.width || next.height !== popoverSize.height) {
            setPopoverSize(next);
          }
        }}
        className="absolute z-[81] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-xl"
        style={{ top: popoverPos.top, left: popoverPos.left }}
      >
        <div className="h-1 w-full bg-brand" />
        <div className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">
            Steg {index + 1} av {PRODUCT_TOUR_STEPS.length}
          </p>
          <h2 id="product-tour-title" className="mt-1.5 text-lg font-bold tracking-tight text-foreground">
            {step.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          <div
            className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={PRODUCT_TOUR_STEPS.length}
            aria-valuenow={index + 1}
          >
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${((index + 1) / PRODUCT_TOUR_STEPS.length) * 100}%` }}
            />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={onSkip}>
              Hopp over
            </Button>
            <div className="flex gap-2">
              {index > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setIndex((value) => value - 1)}
                >
                  Tilbake
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                className={cn('rounded-xl bg-brand text-brand-foreground hover:bg-brand/90')}
                onClick={() => {
                  if (isLast) onComplete();
                  else setIndex((value) => value + 1);
                }}
              >
                {isLast ? 'Ferdig' : 'Neste'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}

function positionPopover(
  target: Rect | null,
  size: { width: number; height: number },
  placement: ProductTourPlacement,
): { top: number; left: number } {
  const margin = 16;
  const vw = typeof window === 'undefined' ? 1200 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight;

  if (!target) {
    return {
      top: Math.max(margin, (vh - size.height) / 2),
      left: Math.max(margin, (vw - size.width) / 2),
    };
  }

  let top = target.top;
  let left = target.left;

  switch (placement) {
    case 'right':
      top = target.top;
      left = target.left + target.width + 16;
      break;
    case 'left':
      top = target.top;
      left = target.left - size.width - 16;
      break;
    case 'bottom':
      top = target.top + target.height + 16;
      left = target.left + target.width / 2 - size.width / 2;
      break;
    case 'top':
      top = target.top - size.height - 16;
      left = target.left + target.width / 2 - size.width / 2;
      break;
    default: {
      const exhaustive: never = placement;
      throw new Error(`Unknown tour placement: ${exhaustive}`);
    }
  }

  top = Math.min(Math.max(margin, top), vh - size.height - margin);
  left = Math.min(Math.max(margin, left), vw - size.width - margin);
  return { top, left };
}

function queryVisible(selector: string): Element | null {
  const nodes = Array.from(document.querySelectorAll(selector));
  return (
    nodes.find((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return (
        rect.width > 2 &&
        rect.height > 2 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none'
      );
    }) ?? null
  );
}
