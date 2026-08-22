import assert from 'node:assert/strict';
import { pickPrimaryVotering, isProtocolVotering } from './stortinget-voteringer';
import type { SakVotering } from './alignment/types';

const protocol: SakVotering = {
  votering_id: 1,
  votering_tema: 'Dokumentet vedlegges protokollen',
  vedtatt: true,
  antall_for: 90,
  antall_mot: 0,
  personlig_votering: true,
};

const amendment: SakVotering = {
  votering_id: 2,
  votering_tema: 'Forslag nr. 7 på vegne av SV.',
  vedtatt: false,
  antall_for: 6,
  antall_mot: 80,
  personlig_votering: true,
  votering_tid: '/Date(1622552993113+0200)/',
};

const main: SakVotering = {
  votering_id: 3,
  votering_tema: 'Alternativ votering mellom innstillingen og forslagene 1-5.',
  vedtatt: true,
  fri_votering: false,
  antall_for: 45,
  antall_mot: 41,
  personlig_votering: true,
  alternativ_votering_id: 4,
  votering_tid: '/Date(1622553049997+0200)/',
};

const alt: SakVotering = {
  votering_id: 4,
  votering_tema: 'Alternativ votering mellom innstillingen og forslagene 1-5.',
  vedtatt: false,
  antall_for: 41,
  antall_mot: 45,
  personlig_votering: true,
  alternativ_votering_id: 3,
  votering_tid: '/Date(1622553049997+0200)/',
};

assert.equal(isProtocolVotering(protocol), true);
assert.equal(pickPrimaryVotering([protocol, amendment, main, alt])?.votering_id, 3);
assert.equal(pickPrimaryVotering([alt, main])?.votering_id, 3);

const onlyProtocol = pickPrimaryVotering([protocol]);
assert.equal(onlyProtocol?.votering_id, 1);

console.log('stortinget-voteringer tests passed');
