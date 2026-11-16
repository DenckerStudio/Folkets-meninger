'use client';

import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useUserAnnotations } from '@/components/user-annotations/user-annotation-context';
import { UserAnnotationsPanelContent } from '@/components/user-annotations/user-annotations-panel-content';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';

function DesktopAnnotationsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-[68] hidden bg-black/40 lg:block"
            aria-label="Lukk notater"
            onClick={onClose}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Research-markeringer"
            className="fixed inset-y-0 right-0 z-[69] hidden w-full max-w-md flex-col border-l border-border bg-background shadow-2xl lg:flex"
            initial={reducedMotion ? false : { x: '100%' }}
            animate={{ x: 0 }}
            exit={reducedMotion ? undefined : { x: '100%' }}
            transition={reducedMotion ? { duration: 0 } : { type: 'tween', duration: 0.25 }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Research-markeringer</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Markeringer i research-funn — bare synlig for deg som admin.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn('min-h-11 min-w-11 shrink-0', FOCUS_RING)}
                aria-label="Lukk"
                onClick={onClose}
              >
                <X className="h-5 w-5" aria-hidden />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <UserAnnotationsPanelContent />
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export function UserAnnotationsPanel() {
  const ctx = useUserAnnotations();
  if (!ctx?.enabled) return null;

  const close = () => ctx.setPanelOpen(false);

  return (
    <>
      <div className="lg:hidden">
        <Drawer
          open={ctx.panelOpen}
          onClose={close}
          title="Research-markeringer"
          description="Markeringer i research-funn — bare synlig for deg som admin."
          className="max-h-[85vh]"
        >
          <UserAnnotationsPanelContent className="px-2" />
        </Drawer>
      </div>
      <DesktopAnnotationsPanel open={ctx.panelOpen} onClose={close} />
    </>
  );
}