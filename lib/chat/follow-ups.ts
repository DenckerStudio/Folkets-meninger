/**
 * A tappable follow-up question shown under the latest assistant reply. These are fixed,
 * honest prompts (no invented content) — the assistant fills them via its own tools.
 */
export type ChatFollowUp = {
  id: string;
  label: string;
  prompt: string;
};

export function buildFollowUps(args: {
  hasIssue: boolean;
  issueTitle?: string | null;
  toolsUsed?: string[];
}): ChatFollowUp[] {
  const { hasIssue, issueTitle, toolsUsed = [] } = args;
  const title = issueTitle?.trim();
  const subject = title ? `«${title}»` : 'saken';

  if (!hasIssue) {
    return [
      { id: 'forklar', label: 'Forklar kort', prompt: 'Forklar det viktigste i denne saken kort og nøkternt.' },
      { id: 'hva-skjer', label: 'Hva skjer nå?', prompt: `Hva er status i ${subject} nå, og hva er neste steg?` },
      { id: 'flere-saker', label: 'Relaterte saker', prompt: 'Finn relaterte saker i cachen.' },
    ];
  }

  const followUps: ChatFollowUp[] = [];
  const usedVote = toolsUsed.some((t) => t.includes('getVoteResults'));

  if (!usedVote) {
    followUps.push({
      id: 'stemmer',
      label: 'Hvordan stemte Stortinget?',
      prompt: `Hvordan har Stortinget votert i ${subject}, og hvordan står det mot folkets vilje?`,
    });
  }
  followUps.push({
    id: 'konsekvenser',
    label: 'Konsekvenser',
    prompt: `Hvilke praktiske konsekvenser har ${subject} for folk i Norge?`,
  });
  followUps.push({
    id: 'motside',
    label: 'Alternativ syn',
    prompt: `Hva er motargumentene mot ${subject}?`,
  });

  return followUps.slice(0, 3);
}
