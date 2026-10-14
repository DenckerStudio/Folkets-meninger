import { pollChoiceLabel } from '@/lib/polls/labels';
import type { PollChoice } from '@/lib/polls/types';

/**
 * B5: the rich `/del` share widget lands with the share-poll work in PR #147.
 * Until that is on `main`, Reels fall back to the native share sheet or
 * clipboard. Flip this to `true` and implement the `/del` branch in
 * `ReelShareButton` once the widget ships.
 *
 * TODO(B5): route poll shares through `/del` for an OG-image preview.
 */
export const SHARE_POLLS_ENABLED = false;

export function buildPollShareText(title: string, choice: PollChoice | null): string {
  const trimmed = title.trim();
  if (choice) {
    return `Jeg stemte ${pollChoiceLabel(choice).toLowerCase()} på «${trimmed}» i Folkets meninger.`;
  }
  return `Stem på «${trimmed}» i Folkets meninger.`;
}
