'use client';

import { useState, type FormEvent } from 'react';

type AdminEmailGrantProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  placeholder: string;
  submitLabel: string;
};

export function AdminEmailGrant({
  value,
  onChange,
  onSubmit,
  pending,
  placeholder,
  submitLabel,
}: AdminEmailGrantProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="flex flex-wrap gap-2" onSubmit={handleSubmit}>
      <input
        type="email"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-[12rem] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
      <button
        type="submit"
        disabled={pending || !value.trim()}
        className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  );
}
