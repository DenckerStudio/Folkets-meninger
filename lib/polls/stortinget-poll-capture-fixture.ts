import type { PollRecord, PollTotals } from '@/lib/polls/types';

/** Fiktiv tittel for skjermbilder — ikke en ekte sak. */
export const CAPTURE_STORTINGET_POLL_LONG_TITLE =
  'Skal staten innføre nye avgiftsregler for næringsliv og privatpersoner i hele landet med ekstra lang tittel for skjermbilde?';

export const CAPTURE_STORTINGET_POLL_NEUTRAL =
  'Fiktiv nøytral ingress brukt kun til dokumentasjonsskjermbilder.';

export const CAPTURE_STORTINGET_POLL_ID = 'fixture-poll-999001';

export const CAPTURE_POLL_TOTALS: PollTotals = {
  ja: 14,
  nei: 9,
  blank: 4,
  total: 27,
};

export function buildCaptureStortingetPollFixture(options: { votingOpen: boolean }): PollRecord {
  const now = new Date().toISOString();
  return {
    id: CAPTURE_STORTINGET_POLL_ID,
    track: 'stortinget',
    status: 'open',
    title: CAPTURE_STORTINGET_POLL_LONG_TITLE,
    neutralSummary: CAPTURE_STORTINGET_POLL_NEUTRAL,
    sourceUrls: [
      {
        label: 'Stortinget',
        url: 'https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=999001',
      },
    ],
    stortingetIssueId: '999001',
    citizenInitiativeId: null,
    opensAt: now,
    closesAt: options.votingOpen ? '2099-12-31T12:00:00.000Z' : '2020-06-01T10:00:00.000Z',
    createdAt: now,
    updatedAt: now,
    expiredAt: null,
    restoredAt: null,
    generationMetadata: {},
  };
}
