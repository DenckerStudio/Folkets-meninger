'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { ForumReportButton } from '@/components/forum/forum-report-button';

type ForumPostCardMenuProps = {
  threadId: string;
};

export function ForumPostCardMenu({ threadId }: ForumPostCardMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        aria-label="Flere handlinger"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <ForumReportButton
            targetType="thread"
            targetId={threadId}
            variant="menu-item"
            onDone={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
