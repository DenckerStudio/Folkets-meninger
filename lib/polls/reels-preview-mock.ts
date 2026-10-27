import type { SystemReelFeedItem } from '@/lib/polls/types';

/** Deterministic dev-only fixture for Reels UI capture (`?preview=mock` in development). */
export const REELS_PREVIEW_MOCK_ITEMS: SystemReelFeedItem[] = [
  {
    poll: {
      id: 'preview-reel-1',
      track: 'system',
      status: 'open',
      title: 'Bør stortinget prioritere mer kollektivtransport i distriktene?',
      neutralSummary:
        'Regjeringen foreslår å øke bevilgningene til regional kollektivtransport over neste fire år. Forslaget innebærer flere avgangstider på mindre strekninger, bedre skysstjenester og en målsetting om at flere skal kunne reise uten egen bil.\n\nMotstandere mener kostnadene er høye i forhold til effekten, og at pengene heller bør gå til vedlikehold av veinettet. Tilhengerne peker på klimamål, mobilitet for unge og eldre, og mindre bilkø i tettsteder.',
      sourceUrls: [{ label: 'Regjeringen.no – høringsnotat', url: 'https://www.regjeringen.no/' }],
      stortingetIssueId: '200329',
      citizenInitiativeId: null,
      opensAt: null,
      closesAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      expiredAt: null,
      restoredAt: null,
      generationMetadata: {},
    },
    totals: { ja: 12, nei: 8, blank: 2, total: 22 },
    userVote: null,
  },
];
