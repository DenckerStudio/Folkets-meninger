'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { NORWAY_COUNTIES } from '@/lib/polls/norway-counties';

export function ProfileFylkePicker({
  fylkeCode,
  onSaved,
}: {
  fylkeCode: string | null;
  onSaved: (code: string | null) => void;
}) {
  const [value, setValue] = useState(fylkeCode ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setValue(fylkeCode ?? '');
  }, [fylkeCode]);

  const save = async (next: string) => {
    setValue(next);
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fylke_code: next || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Kunne ikke lagre fylke');
        return;
      }
      onSaved(next || null);
    } catch {
      setError('En feil oppstod');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 h-5 w-5 text-brand" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">Fylke du følger</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Selvvalgt, ikke BankID-bekreftet. Trengs for merket Fylkesekspert sammen med en bestått
            kunnskapstest. MinID kommer senere.
          </p>
          <select
            value={value}
            onChange={(event) => void save(event.target.value)}
            disabled={saving}
            className="mt-3 w-full max-w-sm rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
          >
            <option value="">Velg fylke</option>
            {NORWAY_COUNTIES.map((county) => (
              <option key={county.code} value={county.code}>
                {county.name}
              </option>
            ))}
          </select>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
