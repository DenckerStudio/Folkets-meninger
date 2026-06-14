'use client';

import Link from 'next/link';
import { routes } from '@/lib/routes';
import { ProfileCard } from '@/components/profile/profile-card';

export type VoteHistoryItem = {
  stortinget_issue_id: string;
  title?: string | null;
  voted_at: string;
};

type ProfileVoteHistoryProps = {
  items: VoteHistoryItem[];
  loading: boolean;
};

export function ProfileVoteHistory({ items, loading }: ProfileVoteHistoryProps) {
  return (
    <ProfileCard title="Siste stemmer" description="Saker du har stemt på. Stemmer er anonyme i offentlig statistikk.">
      {loading ? (
        <p className="text-center py-8 text-gray-500 text-sm">Laster stemmehistorikk…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="font-medium text-gray-900">Ingen stemmer ennå</p>
          <p className="text-sm mt-2">Utforsk saker og stem for å se historikken din her.</p>
          <Link
            href={routes.utforsk}
            className="mt-4 inline-block text-indigo-600 font-medium hover:text-indigo-500 text-sm"
          >
            Utforsk saker →
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 overflow-hidden">
          {items.map((item) => (
            <li key={item.stortinget_issue_id}>
              <Link
                href={routes.sak(item.stortinget_issue_id)}
                className="block px-4 py-4 hover:bg-gray-50 transition-colors"
              >
                <p className="text-sm font-medium text-indigo-600 truncate">
                  {item.title || `Sak ${item.stortinget_issue_id}`}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Stemt: {new Date(item.voted_at).toLocaleDateString('nb-NO')}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ProfileCard>
  );
}
