// node scripts/check-migrations.mjs $(git diff --name-only origin/main -- supabase/migrations)
import fs from 'node:fs';

const files = process.argv.slice(2).filter((f) => f.endsWith('.sql'));
let failed = false;

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const sql = fs.readFileSync(f, 'utf8');
  const fns = [...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([\w."]+)\s*\(/gi)].map(
    (m) => m[1].replace(/"/g, ''),
  );
  for (const fn of fns) {
    const name = fn.split('.').pop();
    const revoke = new RegExp(
      `revoke\\s+(?:all|execute)[\\s\\S]*?function\\s+[\\w."]*${name}\\b[\\s\\S]*?from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated`,
      'i',
    );
    if (!revoke.test(sql)) {
      console.error(`${f}: ${fn} mangler «REVOKE ... FROM PUBLIC, anon, authenticated»`);
      failed = true;
    }
  }
  const tables = [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)/gi)].map(
    (m) => m[1].replace(/"/g, ''),
  );
  for (const t of tables) {
    const name = t.split('.').pop();
    if (
      !new RegExp(`alter\\s+table\\s+[\\w."]*${name}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(
        sql,
      )
    ) {
      console.error(`${f}: ${t} mangler ENABLE ROW LEVEL SECURITY`);
      failed = true;
    }
  }
  if (
    /using\s*\(\s*true\s*\)|with\s+check\s*\(\s*true\s*\)/i.test(sql) &&
    /to\s+(anon|authenticated|public)/i.test(sql)
  ) {
    console.error(`${f}: inneholder USING(true)/WITH CHECK(true) – krever eksplisitt godkjenning`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
