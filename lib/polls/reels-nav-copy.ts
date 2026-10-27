import {
  pollBallotRunningTextPhraseSentenceStart,
  pollBallotSlugPhrase,
} from '@/lib/polls/ballot-buttons';

export type ReelsNavDirection = 'forward' | 'back';

export type ReelsNavCopy = {
  badge: string;
  title: string;
  subtitle: string;
};

export function reelsNavCopy(direction: ReelsNavDirection, itemCount: number): ReelsNavCopy {
  switch (direction) {
    case 'forward':
      return {
        badge: 'Reels',
        title: 'Del din mening',
        subtitle:
          itemCount > 0
            ? `${pollBallotRunningTextPhraseSentenceStart()} på spørsmål fra stortingssaker.`
            : `Ingen systemgenererte ${pollBallotSlugPhrase()}-Reels er publisert ennå.`,
      };
    case 'back':
      return {
        badge: 'Utforsk',
        title: 'Tilbake til saker',
        subtitle: 'Lovforslag og representantforslag.',
      };
    default: {
      const _exhaustive: never = direction;
      return _exhaustive;
    }
  }
}
