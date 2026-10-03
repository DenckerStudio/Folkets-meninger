'use client';

import Link from 'next/link';
import { EmptyLineState } from '@/components/motion/empty-line';
import { MotionList, MotionListRow } from '@/components/motion/list-row';
import { ProfileCard } from '@/components/profile/profile-card';
import { routes } from '@/lib/routes';
import { ISSUE_STANCE_LABELS, type StanceHistoryItem } from '@/lib/stances/types';

type ProfileStanceHistoryProps = {
  items: StanceHistoryItem[];
  loading: boolean;
};

export function ProfileStanceHistory({ items, loading }: ProfileStanceHistoryProps) {
  return (
    <ProfileCard
      title="Mine holdninger"
      description="Enig, uenig eller ikke interessert."
    >
      {loading ? (
        <p className="text-center py-8 text-muted-foreground text-sm">Laster holdningshistorikk…</p>
      ) : items.length === 0 ? (
        <EmptyLineState className="py-8 text-muted-foreground">
          <p className="font-medium text-foreground">Ingen holdninger ennå</p>
          <p className="text-sm mt-2">Utforsk saker og marker holdning for å se historikken din her.</p>
          <Link
            href={routes.utforsk}
            className="mt-4 inline-block text-indigo-600 dark:text-indigo-400 font-medium hover:text-indigo-500 text-sm"
          >
            Utforsk saker →
          </Link>
        </EmptyLineState>
      ) : (
        <MotionList className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {items.map((item) => (
            <MotionListRow id={item.stortinget_issue_id} key={item.stortinget_issue_id}>
              <Link
                href={routes.sak(item.stortinget_issue_id)}
                className="block px-4 py-4 hover:bg-muted/50 transition-colors"
              >
                <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate">
                  {item.title || `Sak ${item.stortinget_issue_id}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ISSUE_STANCE_LABELS[item.stance]} ·{' '}
                  {new Date(item.updated_at).toLocaleDateString('nb-NO')}
                </p>
              </Link>
            </MotionListRow>
          ))}
        </MotionList>
      )}
    </ProfileCard>
  );
}
