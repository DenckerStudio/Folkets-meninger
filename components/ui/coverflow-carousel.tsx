"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export interface CoverflowCarouselProps {
  /** Slide nodes (one per card). */
  slides: React.ReactNode[];
  /** Degrees the first neighbour tilts. */
  rotate?: number;
  /** How far the first neighbour recedes, as a fraction of card width. */
  depth?: number;
  /** Viewer distance as a multiple of card width — smaller is a wider lens. */
  perspective?: number;
  /** Exponent on distance. Below 1 the rake eases off as cards travel out. */
  falloff?: number;
  /** Opacity lost per step from the centre. */
  fade?: number;
  /** Any CSS length. Everything else is derived from it, so the rake scales. */
  cardWidth?: string;
  /** Card height CSS length. Defaults to matching a portrait reel card. */
  cardHeight?: string;
  /** Space between cards, as a fraction of card width. */
  gap?: number;
  loop?: boolean;
  showPagination?: boolean;
  showNavigation?: boolean;
  /** Names the carousel for assistive tech. */
  label?: string;
  className?: string;
  cardClassName?: string;
  /** Fires when the centred card index changes. */
  onIndexChange?: (index: number) => void;
  /** Pause drag settling when true (e.g. while a card is expanded). */
  interactionLocked?: boolean;
}

/**
 * Coverflow Carousel (ruixen.ui / 21st.dev) — adapted for React children
 * instead of image-only slides so Reels can mount vote cards.
 */
export function CoverflowCarousel({
  slides,
  rotate = 44,
  depth = 0.6,
  perspective = 3,
  falloff = 0.56,
  fade = 0.1,
  cardWidth = "clamp(148px, 22vw, 260px)",
  cardHeight = "clamp(220px, 34vw, 380px)",
  gap = 0.05,
  loop = true,
  showPagination = false,
  showNavigation = false,
  label = "Cover carousel",
  className,
  cardClassName,
  onIndexChange,
  interactionLocked = false,
}: CoverflowCarouselProps) {
  const count = slides.length;

  const frameRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  /** Fractional card index at the centre. The single source of truth. */
  const posRef = React.useRef(0);
  /** Where the current settle is headed. */
  const targetRef = React.useRef(0);
  const widthRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);
  const dragRef = React.useRef<{
    id: number;
    x: number;
    pos: number;
    v: number;
    t: number;
  } | null>(null);

  const [selected, setSelected] = React.useState(0);
  const onIndexChangeRef = React.useRef(onIndexChange);

  React.useEffect(() => {
    onIndexChangeRef.current = onIndexChange;
  }, [onIndexChange]);

  const setSelectedIndex = React.useCallback((index: number) => {
    setSelected((prev) => {
      if (prev === index) return prev;
      onIndexChangeRef.current?.(index);
      return index;
    });
  }, []);

  /** Nearest whole card, folded back into 0..count-1. */
  const indexAt = React.useCallback(
    (pos: number) => {
      if (count <= 0) return 0;
      return ((Math.round(pos) % count) + count) % count;
    },
    [count],
  );

  // Paint straight to the DOM. Sixty state updates a second would re-render
  // every card for numbers React never needs to see.
  const paint = React.useCallback(() => {
    const width = widthRef.current;
    if (!width || count <= 0) return;
    const pitch = width * (1 + gap);
    const pos = posRef.current;

    cardRefs.current.forEach((card, index) => {
      if (!card) return;

      // Fold the distance into the shorter way round the ring.
      let offset = index - pos;
      if (loop) {
        offset = ((offset % count) + count) % count;
        if (offset > count / 2) offset -= count;
      }

      const distance = Math.abs(offset);
      const ramp = Math.pow(distance, falloff);
      const tilt = Math.min(rotate * ramp, 82) * Math.sign(offset);

      card.style.transform =
        `translateX(calc(-50% + ${offset * pitch}px)) ` +
        `translateZ(${-depth * width * ramp}px) rotateY(${-tilt}deg)`;

      const edge = loop ? Math.min(1, Math.max(0, count / 2 - distance)) : 1;
      card.style.opacity = String(Math.max(0, 1 - fade * distance) * edge);
      card.style.zIndex = String(100 - Math.round(distance));
      card.style.pointerEvents = distance < 0.5 ? "auto" : "none";
    });
  }, [count, depth, fade, falloff, gap, loop, rotate]);

  const settle = React.useCallback(
    (target: number) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      targetRef.current = target;
      setSelectedIndex(indexAt(target));

      const step = () => {
        const remaining = target - posRef.current;
        if (Math.abs(remaining) < 0.0004) {
          posRef.current = target;
          paint();
          rafRef.current = null;
          return;
        }
        posRef.current += remaining * 0.16;
        paint();
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [indexAt, paint, setSelectedIndex],
  );

  const clamp = React.useCallback(
    (pos: number) => (loop ? pos : Math.max(0, Math.min(count - 1, pos))),
    [count, loop],
  );

  const goTo = React.useCallback(
    (index: number) => {
      if (count <= 0) return;
      const target = loop
        ? index + Math.round((targetRef.current - index) / count) * count
        : index;
      settle(clamp(target));
    },
    [clamp, count, loop, settle],
  );

  const nudge = React.useCallback(
    (by: number) => settle(clamp(Math.round(targetRef.current) + by)),
    [clamp, settle],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (interactionLocked || count <= 1) return;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    targetRef.current = posRef.current;
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      pos: posRef.current,
      v: 0,
      t: performance.now(),
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;

    const pitch = widthRef.current * (1 + gap);
    if (!pitch) return;

    const now = performance.now();
    const previous = posRef.current;
    posRef.current = clamp(drag.pos - (event.clientX - drag.x) / pitch);
    drag.v = ((posRef.current - previous) / Math.max(now - drag.t, 1)) * 1000;
    drag.t = now;

    const index = indexAt(posRef.current);
    if (index !== selected) setSelectedIndex(index);
    paint();
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    const carried = Math.max(-2, Math.min(2, drag.v * 0.18));
    settle(clamp(Math.round(posRef.current + carried)));
  };

  useIsoLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const measure = () => {
      const card = cardRefs.current[0];
      if (!card) return;
      widthRef.current = card.offsetWidth;
      paint();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [paint, slides.length]);

  React.useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  if (count === 0) {
    return null;
  }

  return (
    <div
      className={cn("w-full", className)}
      style={{
        ["--cf-card" as string]: cardWidth,
        ["--cf-card-h" as string]: cardHeight,
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
    >
      <div className="relative">
        <div
          ref={frameRef}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(event) => {
            if (interactionLocked) return;
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              nudge(-1);
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              nudge(1);
            }
          }}
          className={cn(
            "overflow-hidden py-8 outline-none ring-ring focus-visible:ring-2 md:py-10",
            interactionLocked ? "cursor-default" : "cursor-grab active:cursor-grabbing",
          )}
          style={{
            perspective: `calc(var(--cf-card) * ${perspective})`,
            touchAction: "pan-y",
          }}
        >
          <div
            className="relative select-none"
            style={{
              height: "var(--cf-card-h)",
              transformStyle: "preserve-3d",
            }}
          >
            {slides.map((slide, index) => (
              <div
                key={index}
                ref={(node) => {
                  cardRefs.current[index] = node;
                }}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${count}`}
                aria-current={index === selected ? "true" : undefined}
                className={cn(
                  "absolute left-1/2 top-0 overflow-hidden rounded-2xl bg-muted shadow-xl will-change-transform",
                  cardClassName,
                )}
                style={{ width: "var(--cf-card)", height: "var(--cf-card-h)" }}
              >
                {slide}
              </div>
            ))}
          </div>
        </div>

        {showNavigation && count > 1 && (
          <>
            <button
              type="button"
              aria-label="Forrige"
              disabled={interactionLocked}
              onClick={() => nudge(-1)}
              className="absolute left-2 top-1/2 z-[200] -translate-y-1/2 rounded-full bg-[#00205b]/90 p-2 text-white backdrop-blur transition hover:bg-[#00205b] disabled:opacity-40 md:left-3"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Neste"
              disabled={interactionLocked}
              onClick={() => nudge(1)}
              className="absolute right-2 top-1/2 z-[200] -translate-y-1/2 rounded-full bg-[#00205b]/90 p-2 text-white backdrop-blur transition hover:bg-[#00205b] disabled:opacity-40 md:right-3"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>

      {showPagination && count > 1 && (
        <div className="mt-2 flex items-center justify-center gap-2 pb-1">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Gå til kort ${index + 1}`}
              aria-current={index === selected}
              disabled={interactionLocked}
              onClick={() => goTo(index)}
              className={cn(
                "size-2 rounded-full transition-opacity disabled:opacity-40",
                index === selected ? "bg-[#ba0c2f] opacity-100" : "bg-white opacity-40",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
