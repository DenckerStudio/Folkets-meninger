import assert from 'node:assert/strict';
import { getPolitikerRolleInfo } from './politiker-roller';

const statsminister = getPolitikerRolleInfo('Statsminister', true);
assert.equal(statsminister.title, 'Statsminister');
assert.ok(statsminister.description.includes('Regjeringens leder'));

const utenriks = getPolitikerRolleInfo('Utenriksminister', true);
assert.ok(utenriks.description.toLowerCase().includes('utenrikspolitikk'));

const rep = getPolitikerRolleInfo(undefined, false);
assert.equal(rep.title, 'Stortingsrepresentant');
assert.ok(rep.description.includes('valgdistrikt'));

console.log('politiker-roller tests passed');
