'use client';

import { useEffect, type ReactNode } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Drawer } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';

export function ResponsiveEditorSheet({
  open,
  onClose,
  title,
  description,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children: ReactNode;
}) {
  const mobile = useIsMobile();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault();
        document.getElementById('admin-editor-save')?.click();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (mobile) {
    return (
      <Drawer open={open} onClose={onClose} title={title} description={description}>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">{children}</div>
        {footer ? (
          <div className="border-t border-border px-4 py-3 [&_[data-slot=button]]:max-sm:min-h-11">
            {footer}
          </div>
        ) : null}
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} size="xl" footer={footer}>
      {children}
    </Dialog>
  );
}
