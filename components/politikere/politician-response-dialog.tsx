'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, MessageSquareQuote, ShieldCheck } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { routes } from '@/lib/routes';
import type { PolitikerOfficialResponse } from '@/lib/politiker-profile-data';
import type { PolitikerOversikt } from '@/lib/stortinget';

type PoliticianResponseDialogProps = {
  rep: PolitikerOversikt;
  responses: PolitikerOfficialResponse[];
};

function formatPublishedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function truncate(text: string, max = 160): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trim()}…`;
}

export function PoliticianResponseList({ rep, responses }: PoliticianResponseDialogProps) {
  const [activeResponse, setActiveResponse] = useState<PolitikerOfficialResponse | null>(null);

  if (responses.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3">
        {responses.map((response) => (
          <button
            key={response.id}
            type="button"
            onClick={() => setActiveResponse(response)}
            className="w-full rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-indigo-800 line-clamp-2">
                  {response.issueTitle ?? `Sak ${response.stortingetIssueId}`}
                </p>
                <p className="mt-2 text-sm text-gray-700 line-clamp-3">{truncate(response.content)}</p>
                <time className="mt-3 block text-xs text-gray-500">{formatPublishedDate(response.publishedAt)}</time>
              </div>
              <MessageSquareQuote className="h-5 w-5 shrink-0 text-indigo-500" />
            </div>
          </button>
        ))}
      </div>

      <Dialog
        open={activeResponse !== null}
        onClose={() => setActiveResponse(null)}
        title={activeResponse?.issueTitle ?? 'Offisielt svar'}
        description={
          activeResponse ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verifisert svar fra {rep.fornavn} {rep.etternavn}
              </span>
              <span>· {formatPublishedDate(activeResponse.publishedAt)}</span>
            </span>
          ) : undefined
        }
        size="lg"
        footer={
          activeResponse ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-gray-500">Svaret er knyttet til saken under.</p>
              <Link
                href={routes.sak(activeResponse.stortingetIssueId)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                Åpne saken
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          ) : undefined
        }
      >
        {activeResponse ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sak</p>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {activeResponse.issueTitle ?? `Sak ${activeResponse.stortingetIssueId}`}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Svar</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{activeResponse.content}</p>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
