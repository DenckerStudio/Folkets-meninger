'use client';

import { useEffect, useRef, useState } from 'react';
import { Flag } from 'lucide-react';
import {
  FORUM_REPORT_CATEGORIES,
  type ForumReportCategory,
} from '@/lib/forum/reports';

type ForumReportButtonProps = {
  targetType: 'thread' | 'reply';
  targetId: string;
  /** Compact trigger without label (for menus). */
  variant?: 'default' | 'menu-item';
  onDone?: () => void;
};

export function ForumReportButton({
  targetType,
  targetId,
  variant = 'default',
  onDone,
}: ForumReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ForumReportCategory>('other');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'duplicate' | 'error'>('idle');
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

  const submit = async () => {
    setStatus('sending');
    const res = await fetch('/api/forum/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_type: targetType,
        target_id: targetId,
        category,
        reason,
      }),
    });
    if (res.status === 409) {
      setStatus('duplicate');
      return;
    }
    if (!res.ok) {
      setStatus('error');
      return;
    }
    setStatus('sent');
    setOpen(false);
    setReason('');
    onDone?.();
  };

  if (status === 'sent') {
    return <span className="text-xs text-emerald-600">Rapport sendt</span>;
  }

  if (status === 'duplicate') {
    return (
      <span className="text-xs text-amber-700">
        Du har allerede rapportert dette innlegget
      </span>
    );
  }

  const trigger =
    variant === 'menu-item' ? (
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        <Flag className="w-4 h-4 text-rose-500" />
        Rapporter
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-rose-600"
      >
        <Flag className="w-3.5 h-3.5" />
        Rapporter
      </button>
    );

  return (
    <div ref={rootRef} className={variant === 'menu-item' ? 'relative w-full' : 'relative'}>
      {trigger}
      {open && (
        <div
          className={
            variant === 'menu-item'
              ? 'absolute z-20 left-0 right-0 mt-1 rounded-lg border border-gray-200 bg-white p-3 shadow-lg'
              : 'absolute z-10 right-0 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg'
          }
        >
          <p className="text-xs font-medium text-gray-700 mb-2">Årsak</p>
          <div className="space-y-1 mb-2">
            {FORUM_REPORT_CATEGORIES.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer"
              >
                <input
                  type="radio"
                  name={`report-cat-${targetId}`}
                  checked={category === c.id}
                  onChange={() => setCategory(c.id)}
                  className="text-rose-600"
                />
                {c.label}
              </label>
            ))}
          </div>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Utdyp gjerne (valgfritt)"
            className="w-full text-xs border border-gray-200 rounded-md p-2"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              className="text-xs text-gray-500"
              onClick={() => setOpen(false)}
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={status === 'sending'}
              className="text-xs font-medium text-white bg-rose-600 px-2 py-1 rounded"
            >
              Send
            </button>
          </div>
          {status === 'error' && (
            <p className="text-xs text-red-600 mt-1">
              Kunne ikke sende. Logg inn og prøv igjen.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
