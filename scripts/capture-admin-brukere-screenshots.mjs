import { chromium } from 'playwright';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(__dirname, 'screenshot-fixtures');
const outDir = '/opt/cursor/artifacts/admin-brukere';

const scenes = [
  ['admin-brukere-table.html', 'brukere-table'],
  ['admin-brukere-loading.html', 'brukere-loading'],
  ['admin-brukere-empty.html', 'brukere-empty'],
  ['admin-brukere-error.html', 'brukere-error'],
  ['admin-brukere-deactivate-dialog.html', 'brukere-deactivate-dialog'],
  ['admin-brukere-hard-delete-dialog.html', 'brukere-hard-delete-dialog'],
];

mkdirSync(outDir, { recursive: true });
copyFileSync(join(fixtureDir, 'brukere-fixture.css'), join(outDir, 'brukere-fixture.css'));

const browser = await chromium.launch();
const page = await browser.newPage();

for (const [file, base] of scenes) {
  copyFileSync(join(fixtureDir, file), join(outDir, file));
  for (const theme of ['light', 'dark']) {
    for (const viewport of [
      { width: 1280, height: 900, suffix: 'desktop' },
      { width: 360, height: 740, suffix: '360' },
    ]) {
      await page.setViewportSize(viewport);
      const url = `file://${join(outDir, file)}`;
      await page.goto(url);
      await page.evaluate((t) => {
        document.documentElement.classList.toggle('dark', t === 'dark');
        document.documentElement.classList.toggle('light', t === 'light');
      }, theme);
      await page.waitForTimeout(100);
      const out = join(outDir, `${base}-${theme}-${viewport.suffix}.png`);
      await page.screenshot({ path: out, fullPage: true });
      console.log('wrote', out);
    }
  }
}

await browser.close();
