export type PollStatusAction = 'publish' | 'archive';

export function nextPollStatusForAction(
  currentStatus: string,
  action: PollStatusAction,
): { status: 'open' | 'archived'; setOpensAtIfMissing: boolean } {
  switch (action) {
    case 'publish':
      if (currentStatus !== 'draft') {
        throw new Error('Poll is not a draft');
      }
      return { status: 'open', setOpensAtIfMissing: true };
    case 'archive':
      if (currentStatus !== 'draft' && currentStatus !== 'open') {
        throw new Error('Poll cannot be archived');
      }
      return { status: 'archived', setOpensAtIfMissing: false };
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unhandled poll status action: ${_exhaustive}`);
    }
  }
}
