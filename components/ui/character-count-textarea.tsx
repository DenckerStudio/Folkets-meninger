'use client';

import { cn } from '@/lib/utils';

type CharacterCountTextareaProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  rows?: number;
  placeholder?: string;
  'aria-invalid'?: boolean;
  className?: string;
};

/** Textarea med tegn-teller (21st.dev / cnippet-dev v-textarea-6). */
export function CharacterCountTextarea({
  id,
  value,
  onChange,
  maxLength,
  rows = 2,
  placeholder,
  'aria-invalid': ariaInvalid,
  className,
}: CharacterCountTextareaProps) {
  const length = value.trim().length;
  const atMax = value.length >= maxLength;

  return (
    <div className="relative">
      <textarea
        id={id}
        value={value}
        maxLength={maxLength}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={ariaInvalid}
        className={cn(
          'w-full resize-y rounded-xl border border-border bg-card px-3 py-2.5 pb-7 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30',
          className,
        )}
      />
      <span
        className={cn(
          'pointer-events-none absolute bottom-2 right-3 text-[11px] tabular-nums',
          atMax ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-muted-foreground',
        )}
        aria-live="polite"
      >
        {length}/{maxLength}
      </span>
    </div>
  );
}
