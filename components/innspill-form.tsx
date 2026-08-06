'use client';

import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';

const CATEGORIES = [
  { value: 'idé', label: 'Idé / ønske' },
  { value: 'feil', label: 'Feil / bug' },
  { value: 'spørsmål', label: 'Spørsmål' },
  { value: 'annet', label: 'Annet' },
] as const;

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function InnspillForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['value']>('idé');
  const [message, setMessage] = useState('');
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'submitting') return;

    setStatus('submitting');
    setError('');

    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        category,
        message,
        company,
        page_path: '/innspill',
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setStatus('error');
      setError(data.error || 'Kunne ikke sende innspill. Prøv igjen.');
      return;
    }

    setStatus('success');
    setName('');
    setEmail('');
    setCategory('idé');
    setMessage('');
    setCompany('');
  };

  if (status === 'success') {
    return (
      <div className="rounded-2xl border border-[#00205b]/12 bg-white p-8 text-center sm:p-10">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#00205b]/[0.06] text-[#00205b]">
          <MessageSquarePlus className="h-6 w-6" aria-hidden />
        </div>
        <h2 className="text-xl font-bold text-[#001433]">Takk for innspillet</h2>
        <p className="mt-2 text-[#001433]/65 leading-relaxed">
          Vi har mottatt meldingen din og leser alt. Du hører fra oss hvis vi trenger mer info.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="mt-6 inline-flex items-center justify-center rounded-full border border-[#00205b]/15 bg-white px-5 py-2.5 text-sm font-semibold text-[#00205b] transition-colors hover:border-[#00205b]/40"
        >
          Send et nytt innspill
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative rounded-2xl border border-[#00205b]/12 bg-white p-6 sm:p-8 space-y-5"
      noValidate
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[#001433]">Navn (valgfritt)</span>
          <input
            type="text"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="w-full rounded-xl border border-[#00205b]/15 bg-white px-3.5 py-2.5 text-sm text-[#001433] outline-none transition-colors focus:border-[#00205b]/40"
            placeholder="Ditt navn"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[#001433]">E-post</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            className="w-full rounded-xl border border-[#00205b]/15 bg-white px-3.5 py-2.5 text-sm text-[#001433] outline-none transition-colors focus:border-[#00205b]/40"
            placeholder="deg@epost.no"
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-[#001433]">Kategori</span>
        <select
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number]['value'])}
          className="w-full rounded-xl border border-[#00205b]/15 bg-white px-3.5 py-2.5 text-sm text-[#001433] outline-none transition-colors focus:border-[#00205b]/40"
        >
          {CATEGORIES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-[#001433]">Melding</span>
        <textarea
          name="message"
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={4000}
          className="w-full rounded-xl border border-[#00205b]/15 bg-white px-3.5 py-2.5 text-sm text-[#001433] outline-none transition-colors focus:border-[#00205b]/40"
          placeholder="Beskriv idéen, feilen eller spørsmålet ditt…"
        />
      </label>

      {/* Honeypot */}
      <div className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden" aria-hidden>
        <label>
          Company
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </label>
      </div>

      {error ? <p className="text-sm text-[#ba0c2f]">{error}</p> : null}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="inline-flex w-full items-center justify-center rounded-full bg-[#00205b] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ba0c2f] disabled:opacity-50 sm:w-auto"
      >
        {status === 'submitting' ? 'Sender…' : 'Send innspill'}
      </button>
    </form>
  );
}
