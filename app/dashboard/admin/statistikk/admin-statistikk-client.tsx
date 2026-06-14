'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BarChart3, Download } from 'lucide-react';
import { PUBLIC_STATS_DISCLAIMER } from '@/lib/government-stats/snapshot';
import { routes } from '@/lib/routes';

export default function AdminStatistikkClient() {
  const [downloading, setDownloading] = useState(false);

  const downloadCsv = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/admin/government-stats/export?format=csv&limit=200');
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `folkets-stemme-statistikk-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-600" />
          Statistikk-eksport
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Anonyme aggregater for manuell deling. Automatisk sending til myndigheter er ikke aktivert (fase C).
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
        {PUBLIC_STATS_DISCLAIMER}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={downloadCsv}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {downloading ? 'Laster ned…' : 'Last ned CSV'}
        </button>
        <a
          href="/api/admin/government-stats/export?format=json&limit=200"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          JSON (krever innlogging)
        </a>
        <Link
          href={routes.innsikt}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Offentlig innsikt-side →
        </Link>
      </div>

      <Link href={routes.adminForumReports} className="text-sm text-indigo-600 hover:underline">
        ← Forum-rapporter
      </Link>
    </div>
  );
}
