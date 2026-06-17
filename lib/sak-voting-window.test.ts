import assert from 'node:assert/strict';
import {
  formatVotingDaysLeftLabel,
  getSakVotingWindow,
  parseSaksgangEventDate,
} from './sak-voting-window';

assert.equal(parseSaksgangEventDate('15.06.2026 00:00:00')?.getFullYear(), 2026);

const openDetail = {
  ferdigbehandlet: false,
  saksgang: {
    saksgang_steg_liste: [
      {
        navn: 'Behandling',
        saksgang_hendelse_liste: [
          { id: 'VOT', dato: '31.12.2099 00:00:00' },
        ],
      },
    ],
  },
};

const openWindow = getSakVotingWindow(openDetail, { now: new Date('2026-06-15T12:00:00Z') });
assert.equal(openWindow.isOpen, true);
assert.ok((openWindow.daysLeft ?? 0) > 0);

const closedWindow = getSakVotingWindow({ ferdigbehandlet: true });
assert.equal(closedWindow.isOpen, false);

assert.equal(formatVotingDaysLeftLabel(3), '3 dager igjen å stemme');
assert.equal(formatVotingDaysLeftLabel(1), '1 dag igjen å stemme');

console.log('sak-voting-window.test.ts: ok');
