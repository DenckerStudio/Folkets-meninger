import assert from 'node:assert/strict';
import { buildSakFolkVsStortingetView } from '@/lib/sak/folk-vs-stortinget-view';

const votering = {
  votering_id: 1,
  votering_tema: 'Innstillingen',
  vedtatt: true,
  antall_for: 80,
  antall_mot: 20,
  antall_ikke_tilstede: 2,
} as const;

const emptyView = buildSakFolkVsStortingetView({
  folk: { for: 0, against: 0, abstain: 0, total: 0 },
  voteringer: [],
  sakVedtak: { kortvedtak: null, vedtakstekst: null },
  poll: null,
});
assert.ok(emptyView.emptyMessage);

const openPollHidden = buildSakFolkVsStortingetView({
  folk: { for: 10, against: 2, abstain: 0, total: 12 },
  voteringer: [votering],
  sakVedtak: { kortvedtak: 'Innstillingen ble vedtatt.', vedtakstekst: null },
  poll: {
    id: 'poll-1',
    totals: { ja: 8, nei: 2, blank: 1, total: 11 },
    votingOpen: true,
    hasVoted: false,
  },
});
assert.equal(openPollHidden.folkKind, 'none');
assert.equal(openPollHidden.folkHiddenMessage, 'Fordelingen fra avstemningen vises når du har stemt.');
const stOnlyHeadline = buildSakFolkVsStortingetView({
  folk: { for: 0, against: 0, abstain: 0, total: 0 },
  voteringer: [votering],
  sakVedtak: { kortvedtak: 'Innstillingen ble vedtatt.', vedtakstekst: null },
  poll: {
    id: 'poll-1',
    totals: { ja: 8, nei: 2, blank: 1, total: 11 },
    votingOpen: true,
    hasVoted: false,
  },
}).headline;
assert.equal(openPollHidden.headline, stOnlyHeadline);

const historicHeadline = buildSakFolkVsStortingetView({
  folk: { for: 10, against: 2, abstain: 0, total: 12 },
  voteringer: [votering],
  sakVedtak: { kortvedtak: 'Innstillingen ble vedtatt.', vedtakstekst: null },
  poll: null,
}).headline;
assert.notEqual(openPollHidden.headline, historicHeadline);

const closedPoll = buildSakFolkVsStortingetView({
  folk: { for: 0, against: 0, abstain: 0, total: 0 },
  voteringer: [votering],
  sakVedtak: { kortvedtak: 'Innstillingen ble vedtatt.', vedtakstekst: null },
  poll: {
    id: 'poll-1',
    totals: { ja: 8, nei: 2, blank: 1, total: 11 },
    votingOpen: false,
    hasVoted: false,
  },
});
assert.equal(closedPoll.folkKind, 'poll');
assert.ok(closedPoll.pollPercents);

console.log('lib/sak/folk-vs-stortinget-view.test.ts: ok');