'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Share08Icon } from '@hugeicons/core-free-icons';
import { ShareDialog, type ShareDialogProps } from '@/components/share/share-dialog';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';

export type ShareTriggerProps = Omit<ShareDialogProps, 'open' | 'onClose'> & {
  /** Visible text. Without it the trigger is the round icon button used by the profile menu. */
  label?: string;
  ariaLabel?: string;
  className?: string;
  /** Controlled open state, for callers that open other dialogs from `extraActions`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * Round "Del" button in the same style as the profile / handlinger menu triggers
 * (`SmoothDropdown`), opening {@link ShareDialog} instead of navigating away.
 */
export function ShareTrigger({
  label,
  ariaLabel,
  className,
  open: controlledOpen,
  onOpenChange,
  ...dialogProps
}: ShareTriggerProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const reducedMotion = usePrefersReducedMotion();

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel ?? (label ? undefined : 'Del')}
        aria-haspopup="dialog"
        aria-expanded={open}
        initial="rest"
        animate="rest"
        whileHover={reducedMotion ? undefined : 'hover'}
        whileTap={reducedMotion ? undefined : 'tap'}
        className={cn(
          'inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-border bg-popover text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
          label ? 'gap-2 px-4 text-sm font-medium' : 'w-11',
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
          <HugeiconsIcon icon={Share08Icon} className="h-5 w-5" aria-hidden />
        </motion.span>
        {label ? <span>{label}</span> : null}
      </motion.button>
      <ShareDialog {...dialogProps} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
