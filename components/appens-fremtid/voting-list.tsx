'use client';

import { ThumbsDown, ThumbsUp } from 'lucide-react';
import {
  suggestionAudienceLabel,
  suggestionCategoryLabel,
  type SuggestionRecord,
  type SuggestionVote,
} from '@/lib/appens-fremtid/constants';
import { cn } from '@/lib/utils';

export function VotingList({
  suggestions,
  pending,
  onVote,
}: {
  suggestions: SuggestionRecord[];
  pending: boolean;
  onVote: (id: string, vote: SuggestionVote) => void;
}) {
  if (suggestions.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Ingen forslag er lagt ut til stemming ennå.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {suggestions.map((suggestion) => (
        <li key={suggestion.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-foreground">{suggestion.title}</h3>
            <p className="text-sm text-foreground whitespace-pre-wrap">{suggestion.body}</p>
            <p className="text-xs text-muted-foreground">
              {suggestionCategoryLabel(suggestion.category)} · {suggestionAudienceLabel(suggestion.audience)}
              {suggestion.authorName ? ` · ${suggestion.authorName}` : ''}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <VoteButton
              label="For"
              count={suggestion.upCount}
              active={suggestion.myVote === 'up'}
              disabled={pending}
              onClick={() => onVote(suggestion.id, 'up')}
              icon={ThumbsUp}
            />
            <VoteButton
              label="Mot"
              count={suggestion.downCount}
              active={suggestion.myVote === 'down'}
              disabled={pending}
              onClick={() => onVote(suggestion.id, 'down')}
              icon={ThumbsDown}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function VoteButton({
  label,
  count,
  active,
  disabled,
  onClick,
  icon: Icon,
}: {
  label: string;
  count: number;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: typeof ThumbsUp;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50',
        active
          ? 'bg-brand/10 text-brand'
          : 'border border-border text-foreground hover:bg-muted/50',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label} ({count})
    </button>
  );
}
