import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const panel = readFileSync(
  join(process.cwd(), 'components/admin/analytics/errors-panel.tsx'),
  'utf-8',
);
const client = readFileSync(
  join(process.cwd(), 'app/dashboard/admin/statistikk/admin-statistikk-client.tsx'),
  'utf-8',
);

assert.match(panel, /appLoading/);
assert.match(panel, /appError/);
assert.match(panel, /appReady/);
assert.match(panel, /Laster app-feil/);
assert.match(panel, /Kunne ikke laste app-feil/);
assert.match(panel, /role="alert"/);
assert.match(panel, /Fra serveren/);
assert.match(panel, /Feilstatistikk fra serveren er ikke satt opp ennå/);
assert.match(panel, /caption className="sr-only">Statusklasser fra serveren/);
assert.match(panel, /caption className="sr-only">5xx per dag fra serveren/);
assert.match(panel, /caption className="sr-only">Topp app-feil siste 30 dager/);
assert.match(panel, /fiveXxByDay/);
assert.doesNotMatch(panel, /Fra edge \(Traefik\)/);
assert.doesNotMatch(panel, /Coolify Expert/);

assert.match(client, /appLoading=\{appLoading\}/);
assert.match(client, /appError=\{appError\}/);
assert.match(client, /appReady=\{appReady\}/);
assert.match(client, /aria-hidden="true"/);
assert.match(client, /\(åpnes i ny fane\)/);

console.log('components/admin/analytics/errors-panel.test.ts: ok');
