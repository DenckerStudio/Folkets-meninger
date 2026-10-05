'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/dashboard/empty-state';
import { MotionList, MotionListRow } from '@/components/motion/list-row';
import { ProfileCard } from '@/components/profile/profile-card';
import { routes } from '@/lib/routes';

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
    <ProfileCard title="Siste stemmer" description="Anonyme i offentlig statistikk.">
      {loading ? (
        <p className="text-center py-8 text-muted-foreground text-sm">Laster stemmehistorikk…</p>
      ) : items.length === 0 ? (
        <EmptyState
          compact
          title="Ingen stemmer ennå"
          description="Utforsk saker og stem for å se historikken din her."
          action={
            <Link href={routes.utforsk} className="text-sm font-medium text-brand hover:underline">
              Utforsk saker
            </Link>
          }
        />
      ) : (
        <MotionList className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {items.map((item) => (
            <MotionListRow id={item.stortinget_issue_id} key={item.stortinget_issue_id}>
              <Link
                href={routes.sak(item.stortinget_issue_id)}
                className="group block px-4 py-4 hover:bg-muted/50 transition-colors"
              >
                <p className="text-sm font-medium text-foreground truncate group-hover:text-brand">
                  {item.title || `Sak ${item.stortinget_issue_id}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Stemt: {new Date(item.voted_at).toLocaleDateString('nb-NO')}
                </p>
              </Link>
            </MotionListRow>
          ))}
        </MotionList>
      )}
    </ProfileCard>
  );
}
