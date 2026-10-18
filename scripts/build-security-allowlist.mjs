/**
 * Scanner repo for Supabase .rpc() / .from() usage and prints allowlist hints.
 * Run: node scripts/build-security-allowlist.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP = new Set(['node_modules', '.next', 'cms/.next', '.git']);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(ent.name)) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
const rpcByFile = new Map();
const tablesByFile = new Map();

for (const file of files) {
  const rel = path.relative(ROOT, file);
  if (!rel.startsWith('lib/') && !rel.startsWith('app/') && !rel.startsWith('components/')) continue;
  const src = fs.readFileSync(file, 'utf8');
  const usesService = /getServiceSupabase/.test(src);
  const usesAnon = /getAnonSupabase/.test(src);
  const usesSession = /getServerSupabase|getBrowserSupabase/.test(src);

  const rpcs = [...src.matchAll(/\.rpc\(\s*['"]([a-z_0-9]+)['"]/g)].map((m) => m[1]);
  if (rpcs.length) rpcByFile.set(rel, { rpcs, usesService, usesAnon, usesSession });

  const tables = [...src.matchAll(/\.from\(\s*['"]([a-z_0-9]+)['"]/g)].map((m) => m[1]);
  if (tables.length) tablesByFile.set(rel, { tables, usesService, usesAnon, usesSession });
}

const anonRpc = new Set();
const sessionRpc = new Set();
const serviceRpc = new Set();

for (const { rpcs, usesService, usesAnon, usesSession } of rpcByFile.values()) {
  for (const name of rpcs) {
    if (usesService && !usesAnon && !usesSession) serviceRpc.add(name);
    else if (usesAnon && !usesSession) anonRpc.add(name);
    else if (usesSession || usesAnon) sessionRpc.add(name);
    else serviceRpc.add(name);
  }
}

console.log('# RPC allowlist hints (heuristic — verify in docs/security-allowlist.md)\n');
console.log('## anon / public read client');
console.log([...anonRpc].sort().join('\n') || '(none)');
console.log('\n## session / anon mixed (often authenticated JWT)');
console.log([...sessionRpc].sort().join('\n') || '(none)');
console.log('\n## service_role only (app server)');
console.log([...serviceRpc].sort().join('\n') || '(none)');
