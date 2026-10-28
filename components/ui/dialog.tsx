'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { useBodyOverlayFlag } from '@/hooks/use-body-overlay';
import { MODAL_TRANSITION } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils';

function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

type DialogSize = 'md' | 'lg' | 'xl' | 'full';

const SIZE_CLASS: Record<DialogSize, string> = {
  md: 'sm:max-w-2xl',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-5xl',
  full: 'sm:max-w-6xl',
};

const openDialogs: HTMLElement[] = [];
const dialogRestoreTargets = new WeakMap<HTMLElement, HTMLElement | null>();
const DIALOG_Z_INDEX_BASE = 80;
const DIALOG_Z_INDEX_STEP = 10;

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'summary',
  'audio[controls]',
  'video[controls]',
  '[contenteditable=""]',
  '[contenteditable="true" i]',
  '[contenteditable="plaintext-only" i]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.matches(':disabled') &&
      element.getAttribute('aria-disabled') !== 'true' &&
      !element.closest('[hidden], [aria-hidden="true"], [inert]') &&
      window.getComputedStyle(element).visibility !== 'hidden' &&
      element.getClientRects().length > 0,
  );
}

function isOverlayElement(element: HTMLElement): boolean {
  return element.matches(
    '[data-shared-dialog-overlay], [data-shared-dialog-backdrop]',
  );
}

function overlayDialogFor(element: HTMLElement): HTMLElement | null {
  return (
    element.closest<HTMLElement>('[data-shared-dialog]') ??
    element
      .closest<HTMLElement>('[data-shared-dialog-overlay]')
      ?.querySelector<HTMLElement>('[data-shared-dialog]') ??
    null
  );
}

function restoreFocus(previouslyFocused: HTMLElement | null): void {
  const visitedTargets = new Set<HTMLElement>();
  let focusTarget = previouslyFocused;

  while (focusTarget && !visitedTargets.has(focusTarget)) {
    visitedTargets.add(focusTarget);
    const previouslyFocusedDialog = overlayDialogFor(focusTarget);
    const overlayIsOpen =
      previouslyFocusedDialog != null &&
      openDialogs.includes(previouslyFocusedDialog);

    if (isOverlayElement(focusTarget)) {
      if (overlayIsOpen && previouslyFocusedDialog) {
        const [firstFocusable] = getFocusableElements(previouslyFocusedDialog);
        (firstFocusable ?? previouslyFocusedDialog).focus();
        return;
      }
      if (!previouslyFocusedDialog) return;
      focusTarget = dialogRestoreTargets.get(previouslyFocusedDialog) ?? null;
      continue;
    }

    if (previouslyFocusedDialog && !openDialogs.includes(previouslyFocusedDialog)) {
      focusTarget = dialogRestoreTargets.get(previouslyFocusedDialog) ?? null;
      continue;
    }

    if (focusTarget.isConnected) {
      focusTarget.focus();
      return;
    }

    if (!previouslyFocusedDialog) return;
    focusTarget = dialogRestoreTargets.get(previouslyFocusedDialog) ?? null;
  }
}

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  className?: string;
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'lg',
  className,
}: DialogProps) {
  const mounted = useIsMounted();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [stackIndex, setStackIndex] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const transition = reducedMotion ? { duration: 0 } : MODAL_TRANSITION;
  useBodyOverlayFlag(open);

  useLayoutEffect(() => {
    if (!open || !mounted) return;
    setStackIndex(openDialogs.length);
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !mounted) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const [firstFocusable] = getFocusableElements(dialog);

    dialogRestoreTargets.set(dialog, previouslyFocused);
    openDialogs.push(dialog);
    (firstFocusable ?? dialog).focus();

    return () => {
      const wasTopmost = openDialogs.at(-1) === dialog;
      const dialogIndex = openDialogs.lastIndexOf(dialog);
      if (dialogIndex !== -1) {
        openDialogs.splice(dialogIndex, 1);
      }

      if (wasTopmost) {
        restoreFocus(previouslyFocused);
      }
    };
  }, [open, mounted]);

  useEffect(() => {
    if (!open || !mounted) return;
    const onKey = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog || openDialogs.at(-1) !== dialog || event.defaultPrevented) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements(dialog);
      const firstFocusable = focusableElements.at(0);
      const lastFocusable = focusableElements.at(-1);

      if (!firstFocusable || !lastFocusable) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const activeElement = document.activeElement;
      const focusIsOutsideDialog = !dialog.contains(activeElement);
      if (
        event.shiftKey &&
        (activeElement === firstFocusable || activeElement === dialog || focusIsOutsideDialog)
      ) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === lastFocusable || activeElement === dialog || focusIsOutsideDialog)
      ) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, mounted, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="quiet-dialog"
          data-shared-dialog-overlay
          className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center sm:p-4"
          style={{ zIndex: DIALOG_Z_INDEX_BASE + stackIndex * DIALOG_Z_INDEX_STEP }}
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={transition}
        >
          <div
            className="absolute inset-0 bg-overlay/50 backdrop-blur-[2px] dark:bg-overlay/60"
            data-shared-dialog-backdrop
            onClick={onClose}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            data-shared-dialog
            tabIndex={-1}
            initial={reducedMotion ? false : { opacity: 0, scale: 0.972 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.985 }}
            transition={transition}
            className={cn(
              'relative z-10 flex h-auto w-full min-w-0 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden',
              'max-h-[min(90dvh,calc(100dvh-1.5rem))] sm:max-h-[min(92vh,900px)]',
              'rounded-2xl border border-border bg-card shadow-xl',
              'pb-[max(0.25rem,env(safe-area-inset-bottom))]',
              SIZE_CLASS[size],
              className,
            )}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-base font-bold break-words text-foreground sm:text-lg">
                  {title}
                </h2>
                {description ? (
                  <p id={descriptionId} className="mt-1 text-sm break-words text-muted-foreground">
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Lukk dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
              {children}
            </div>

            {footer ? (
              <div className="shrink-0 border-t border-border px-4 py-3 sm:px-5 sm:py-4">{footer}</div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
