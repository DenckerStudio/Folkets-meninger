'use client';

import { useEffect, useState } from 'react';

export function ProfileNameSettings() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/user/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.first_name) setFirstName(data.first_name);
        if (data.last_name) setLastName(data.last_name);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage('');
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: firstName, last_name: lastName }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error || 'Kunne ikke lagre');
      return;
    }
    setMessage('Navn lagret.');
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Ditt navn i forumet</h3>
        <p className="text-sm text-gray-500 mt-1">
          Foruminnlegg viser fornavn og etternavn. Stemmer på saker forblir anonyme i statistikken.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="settings-first-name" className="block text-sm font-medium text-gray-700">
            Fornavn
          </label>
          <input
            id="settings-first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            minLength={2}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="settings-last-name" className="block text-sm font-medium text-gray-700">
            Etternavn
          </label>
          <input
            id="settings-last-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            minLength={2}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {message && <p className="text-sm text-gray-600">{message}</p>}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="inline-flex px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? 'Lagrer…' : 'Lagre navn'}
      </button>
    </div>
  );
}
