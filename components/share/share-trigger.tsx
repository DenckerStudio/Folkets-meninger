'use client';

import { useCallback, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Share08Icon } from '@hugeicons/core-free-icons';
import { ShareDialog, type ShareDialogProps } from '@/components/share/share-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { tryNativeShare } from '@/lib/share/native-share';
import { cn } from '@/lib/utils';

export type ShareTriggerProps = Omit<ShareDialogProps, 'open' | 'onClose'> & {
  label?: string;
  ariaLabel?: string;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/** Del-trigger styled like the profile / handlinger menu (`SmoothDropdown`). */
export function ShareTrigger({
  label,
  ariaLabel,
  className,
  open: controlledOpen,
  onOpenChange,
  title,
  text,
  url,
  channelUrl,
  overlayTop,
  ...dialogProps
}: ShareTriggerProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isMobile = useIsMobile();
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange],
  );
  const reducedMotion = usePrefersReducedMotion();

  const handleClose = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [setOpen]);

  const openDialog = useCallback(() => setOpen(true), [setOpen]);

  const handleTriggerClick = useCallback(async () => {
    if (isMobile) {
      const result = await tryNativeShare({ title, text, url, channelUrl });
      if (result === 'shared' || result === 'aborted') return;
    }
    openDialog();
  }, [channelUrl, isMobile, openDialog, text, title, url]);

  return (
    <>
      <motion.button
        ref={triggerRef}
        type="button"
        onClick={() => void handleTriggerClick()}
        aria-label={ariaLabel ?? (label ? undefined : 'Del')}
        aria-haspopup="dialog"
        aria-expanded={open}
        initial="rest"
        animate="rest"
        whileHover={reducedMotion ? undefined : 'hover'}
        whileTap={reducedMotion ? undefined : 'tap'}
        className={cn(
          'inline-flex h-11 min-h-11 shrink-0 items-center justify-center rounded-xl border border-border bg-popover text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          label ? 'gap-2 px-4 text-sm font-medium' : 'w-11 min-w-11',
          className,
        )}
      >
        <motion.span
          className="inline-flex"
          variants={{
            rest: { rotate: 0, x: 0, y: 0, scale: 1 },
            hover: { rotate: -12, x: 1, y: -1, scale: 1.08 },
            tap: { scale: 0.88 },
          }}
          transition={{ type: 'spring', stiffness: 420, damping: 18 }}
        >
          <HugeiconsIcon icon={Share08Icon} className="h-6 w-6" aria-hidden />
        </motion.span>
        {label ? <span>{label}</span> : null}
      </motion.button>
      <ShareDialog
        {...dialogProps}
        url={url}
        title={title}
        text={text}
        channelUrl={channelUrl}
        overlayTop={overlayTop}
        open={open}
        onClose={handleClose}
      />
    </>
  );
}
