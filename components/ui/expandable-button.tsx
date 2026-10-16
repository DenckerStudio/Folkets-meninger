'use client';

import React from 'react';
import { AnimatePresence, type HTMLMotionProps, motion } from 'motion/react';

import { cn } from '@/lib/utils';

export interface ExpandableButtonProps {
  expanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
  /** When false, clicks do not toggle expanded state (hover-controlled triggers). */
  toggleOnClick?: boolean;
  icon?: React.ReactNode;
}

export function ExpandableButton({
  expanded: expandedProp,
  onExpandedChange: setExpandedProp,
  toggleOnClick = true,
  icon,
  className,
  onClick,
  children,
  ...props
}: HTMLMotionProps<'button'> & ExpandableButtonProps) {
  const [_expanded, _setExpanded] = React.useState(false);

  const expanded = expandedProp ?? _expanded;

  const setExpanded = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const expandedState = typeof value === 'function' ? value(expanded) : value;

      if (setExpandedProp) {
        setExpandedProp(expandedState);
      } else {
        _setExpanded(expandedState);
      }
    },
    [setExpandedProp, expanded],
  );

  const onClickHandler = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (toggleOnClick) {
      setExpanded(!expanded);
    }
    onClick?.(e);
  };

  return (
    <motion.button
      layout
      type="button"
      onClick={onClickHandler}
      className={cn(
        'relative flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-lg font-medium text-primary-foreground',
        className,
      )}
      initial={false}
      animate={{
        flexGrow: expanded ? 1 : 0,
        maxWidth: expanded ? '100%' : '3rem',
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
      }}
      {...props}
    >
      <AnimatePresence mode="wait">
        {expanded ? (
          <motion.div
            key="active"
            className="flex h-full w-full items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex w-full items-center justify-center gap-2">
              <motion.div initial={{ scale: 1.2 }} animate={{ scale: 1 }} transition={{ duration: 0.2 }}>
                {icon}
              </motion.div>
              <motion.span
                className="whitespace-nowrap"
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
              >
                {children}
              </motion.span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="inactive"
            className="flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            {icon}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
