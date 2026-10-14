'use client';

import {
  type ComponentProps,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type StoriesContextValue = {
  currentIndex: number;
  direction: 'forward' | 'backward';
  total: number;
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
  pause: () => void;
  resume: () => void;
  active: boolean;
  setActive: (active: boolean) => void;
  progress: number;
};

const StoriesContext = createContext<StoriesContextValue | null>(null);

function useStories() {
  const ctx = useContext(StoriesContext);
  if (!ctx) throw new Error('useStories must be used within Stories');
  return ctx;
}

interface StoriesProps extends HTMLAttributes<HTMLDivElement> {
  loop?: boolean;
  autoPlay?: boolean;
  autoPlayDuration?: number;
  onIndexChange?: (index: number) => void;
}

const Stories = forwardRef<HTMLDivElement, StoriesProps>(
  (
    {
      className,
      children,
      loop = true,
      autoPlay = false,
      autoPlayDuration = 4000,
      onIndexChange,
      ...props
    },
    ref
  ) => {
    const total = useMemo(() => {
      if (!Array.isArray(children)) return 1;
      let count = 0;
      for (const c of children) {
        if (c && typeof c === 'object' && 'type' in (c as any)) {
          const type = (c as any).type;
          // Check displayName or function name
          if (type === Story || type?.displayName === 'Story' || type?.name === 'Story') {
            count++;
          } else if (c && (c as any).props?.children && Array.isArray((c as any).props.children)) {
            // maybe StoriesContent contains stories
            for (const gc of (c as any).props.children) {
              if (gc && typeof gc === 'object' && 'type' in (gc as any)) {
                const gtype = (gc as any).type;
                if (gtype === Story || gtype?.displayName === 'Story' || gtype?.name === 'Story') {
                  count++;
                }
              }
            }
          }
        }
      }
      return count;
    }, [children]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
    const [active, setActive] = useState(true);
    const [progress, setProgress] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastProgressRef = useRef<number>(0);

    const clearTimers = useCallback(() => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    }, []);

    const goTo = useCallback(
      (index: number) => {
        if (total === 0) return;
        const nextIndex = ((index % total) + total) % total;
        if (nextIndex === currentIndex) return;
        setDirection(nextIndex > currentIndex ? 'forward' : 'backward');
        setCurrentIndex(nextIndex);
        onIndexChange?.(nextIndex);
        setProgress(0);
        lastProgressRef.current = 0;
      },
      [currentIndex, onIndexChange, total]
    );

    const next = useCallback(() => {
      if (total === 0) return;
      if (currentIndex < total - 1) {
        goTo(currentIndex + 1);
      } else if (loop) {
        goTo(0);
      }
    }, [currentIndex, goTo, loop, total]);

    const prev = useCallback(() => {
      if (total === 0) return;
      if (currentIndex > 0) {
        goTo(currentIndex - 1);
      } else if (loop) {
        goTo(total - 1);
      }
    }, [currentIndex, goTo, loop, total]);

    const pause = useCallback(() => {
      setActive(false);
      clearTimers();
    }, [clearTimers]);

    const resume = useCallback(() => {
      setActive(true);
    }, []);

    const prevIndexRef = useRef(currentIndex);

    useEffect(() => {
      clearTimers();
      if (!autoPlay || !active || total === 0) return;

      const startTime = Date.now();
      lastProgressRef.current = progress;

      progressTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const p = Math.min(100, (elapsed / autoPlayDuration) * 100);
        setProgress(p);
        lastProgressRef.current = p;
      }, 50);

      timerRef.current = setTimeout(() => {
        next();
      }, autoPlayDuration);

      return clearTimers;
    }, [active, autoPlay, autoPlayDuration, clearTimers, currentIndex, next, total]);

    const value = useMemo<StoriesContextValue>(
      () => ({
        currentIndex,
        direction,
        total,
        goTo,
        next,
        prev,
        pause,
        resume,
        active,
        setActive,
        progress,
      }),
      [currentIndex, direction, total, goTo, next, prev, pause, resume, active, progress]
    );

    return (
      <StoriesContext.Provider value={value}>
        <div
          ref={ref}
          className={cn('relative w-full h-full flex flex-col', className)}
          {...props}
        >
          {children}
        </div>
      </StoriesContext.Provider>
    );
  }
);
Stories.displayName = 'Stories';

interface StoriesHeaderProps extends HTMLAttributes<HTMLDivElement> {}

const StoriesHeader = forwardRef<HTMLDivElement, StoriesHeaderProps>(
  ({ className, ...props }, ref) => {
    const { total, currentIndex, progress, goTo, active } = useStories();

    return (
      <div ref={ref} className={cn('flex gap-1 p-2', className)} {...props}>
        {Array.from({ length: total }).map((_, index) => {
          const isCurrent = index === currentIndex;
          const isViewed = index < currentIndex;
          const isUpcoming = index > currentIndex;
          const segmentProgress = isViewed ? 100 : isCurrent ? (active ? progress : 100) : 0;
          const segmentColor = isViewed ? 'bg-white/60' : isCurrent ? 'bg-blue-300' : 'bg-white/20';
          return (
            <div
              key={index}
              className="h-0.5 flex-1 rounded-full bg-white/40 overflow-hidden cursor-pointer"
              onClick={() => goTo(index)}
              aria-label={`Reel ${index + 1} av ${total}`}
            >
              <div
                className={cn('h-full transition-[width] duration-50 ease-linear', segmentColor)}
                aria-current={isCurrent ? 'true' : undefined}
                style={{ width: `${segmentProgress}%` }}
              />
            </div>
          );
        })}
      </div>
    );
  }
);
StoriesHeader.displayName = 'StoriesHeader';

interface StoriesContentProps extends HTMLAttributes<HTMLDivElement> {}

const StoriesContent = forwardRef<HTMLDivElement, StoriesContentProps>(
  ({ className, children, ...props }, ref) => {
    const { currentIndex, direction, pause, resume, next, prev } = useStories();
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
      setTouchStart(e.targetTouches[0].clientX);
      setTouchEnd(null);
      pause();
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
      setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
      if (!touchStart || !touchEnd) return;
      const distance = touchStart - touchEnd;
      const minSwipe = 50;
      if (distance > minSwipe) next();
      else if (distance < -minSwipe) prev();
      resume();
      setTouchStart(null);
      setTouchEnd(null);
    };

    const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
      setTouchStart(e.clientX);
      pause();
    };

    const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
      if (touchStart !== null) setTouchEnd(e.clientX);
    };

    const handleMouseUp = () => {
      if (!touchStart || !touchEnd) {
        resume();
        setTouchStart(null);
        setTouchEnd(null);
        return;
      }
      const distance = touchStart - touchEnd;
      const minSwipe = 50;
      if (distance > minSwipe) next();
      else if (distance < -minSwipe) prev();
      resume();
      setTouchStart(null);
      setTouchEnd(null);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === ' ') {
        e.preventDefault();
        pause();
      }
    };

    const handleKeyUp = (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === ' ') resume();
    };

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex-1 min-h-0 overflow-hidden rounded-b-2xl',
          className
        )}
        tabIndex={0}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        {...props}
      >
        {(() => {
          const stories: React.ReactNode[] = [];
          const collect = (nodes: any) => {
            if (!nodes) return;
            if (Array.isArray(nodes)) {
              for (const n of nodes) collect(n);
              return;
            }
            if (typeof nodes === 'object' && 'type' in nodes) {
              const t = (nodes as any).type;
              if (t === Story || t?.displayName === 'Story' || t?.name === 'Story') {
                stories.push(nodes);
                return;
              }
              if ((nodes as any).props?.children) {
                collect((nodes as any).props.children);
              }
              return;
            }
          };
          collect(children);
          if (stories.length === 0 && children) stories.push(children as any);
          return stories.map((child, index) => (
            <div
              key={index}
              className={cn(
                'absolute inset-x-0 top-0 bottom-0 w-full transition-transform duration-300 ease-out',
                index === currentIndex
                  ? 'translate-x-0'
                  : direction === 'forward'
                  ? index < currentIndex
                    ? '-translate-x-full'
                    : 'translate-x-full'
                  : index > currentIndex
                  ? 'translate-x-full'
                  : '-translate-x-full'
              )}
              style={{
                display: Math.abs(index - currentIndex) <= 1 ? 'block' : 'none',
              }}
            >
              {child}
            </div>
          ));
        })()}
      </div>
    );
  }
);
StoriesContent.displayName = 'StoriesContent';

interface StoryProps extends HTMLAttributes<HTMLDivElement> {}

const Story = forwardRef<HTMLDivElement, StoryProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('relative w-full max-h-full flex flex-col bg-[#00205b] overflow-y-auto overscroll-contain', className)}
      {...props}
    >
      {children}
    </div>
  )
);
Story.displayName = 'Story';

const StoryVideo = forwardRef<HTMLVideoElement, ComponentProps<'video'>>(
  ({ className, ...props }, ref) => (
    <video
      ref={ref}
      className={cn('absolute inset-0 w-full h-full object-cover', className)}
      playsInline
      muted
      {...props}
    />
  )
);
StoryVideo.displayName = 'StoryVideo';

interface StoryOverlayProps extends HTMLAttributes<HTMLDivElement> {}

const StoryOverlay = forwardRef<HTMLDivElement, StoryOverlayProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent', className)}
      {...props}
    />
  )
);
StoryOverlay.displayName = 'StoryOverlay';

const StoryAuthor = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('absolute bottom-4 left-4 flex items-center gap-2', className)}
      {...props}
    />
  )
);
StoryAuthor.displayName = 'StoryAuthor';

const StoryAuthorImage = forwardRef<HTMLImageElement, ComponentProps<'img'>>(
  ({ className, ...props }, ref) => (
    <img
      ref={ref}
      className={cn('w-8 h-8 rounded-full object-cover border-2 border-white', className)}
      alt={props.alt || ''}
      {...props}
    />
  )
);
StoryAuthorImage.displayName = 'StoryAuthorImage';

const StoryAuthorName = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span ref={ref} className={cn('text-white text-sm font-medium', className)} {...props} />
  )
);
StoryAuthorName.displayName = 'StoryAuthorName';

interface StoriesNavigationProps extends HTMLAttributes<HTMLDivElement> {
  showArrows?: boolean;
}

const StoriesNavigation = forwardRef<HTMLDivElement, StoriesNavigationProps>(
  ({ className, showArrows = true, ...props }, ref) => {
    const { next, prev } = useStories();

    if (!showArrows) return null;

    return (
      <div
        ref={ref}
        className={cn('absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 flex justify-between px-3 pointer-events-none', className)}
        {...props}
      >
        <Button
          variant="secondary"
          size="icon"
          aria-label="Forrige Reel"
          className="pointer-events-auto h-8 w-8 rounded-full bg-white/90 hover:bg-white"
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Neste Reel"
          className="pointer-events-auto h-8 w-8 rounded-full bg-white/90 hover:bg-white"
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }
);
StoriesNavigation.displayName = 'StoriesNavigation';

interface StoriesNavigationInlineProps extends HTMLAttributes<HTMLDivElement> {}

const StoriesNavigationInline = forwardRef<HTMLDivElement, StoriesNavigationInlineProps>(
  ({ className, ...props }, ref) => {
    const { next, prev } = useStories();

    return (
      <div
        ref={ref}
        className={cn('flex items-center gap-2', className)}
        {...props}
      >
        <Button
          variant="secondary"
          size="icon"
          aria-label="Forrige Reel"
          className="h-11 w-11 rounded-full bg-white/90 hover:bg-white"
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Neste Reel"
          className="h-11 w-11 rounded-full bg-white/90 hover:bg-white"
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    );
  }
);
StoriesNavigationInline.displayName = 'StoriesNavigationInline';


interface StoriesCounterProps extends HTMLAttributes<HTMLDivElement> {}

const StoriesCounter = forwardRef<HTMLDivElement, StoriesCounterProps>(
  ({ className, ...props }, ref) => {
    const { currentIndex, total } = useStories();

    if (total === 0) return null;

    return (
      <div
        ref={ref}
        className={cn('text-xs font-medium text-white/90', className)}
        {...props}
      >
        {currentIndex + 1} / {total}
      </div>
    );
  }
);
StoriesCounter.displayName = 'StoriesCounter';

export {
  Stories,
  StoriesHeader,
  StoriesContent,
  Story,
  StoryVideo,
  StoryOverlay,
  StoryAuthor,
  StoryAuthorImage,
  StoryAuthorName,
  StoriesNavigation,
  StoriesNavigationInline,
  StoriesCounter,
};
