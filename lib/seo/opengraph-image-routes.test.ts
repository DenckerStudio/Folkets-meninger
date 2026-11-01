import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '../..');

function collectOpenGraphImageModules(dir: string, acc: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.next') continue;
      collectOpenGraphImageModules(full, acc);
    } else if (ent.isFile() && ent.name === 'opengraph-image.tsx') {
      acc.push(full);
    }
  }
}

test('opengraph-image modules do not export generateImageMetadata', () => {
  const modules: string[] = [];
  collectOpenGraphImageModules(path.join(repoRoot, 'app'), modules);
  assert.ok(modules.length >= 1, 'expected at least one app/opengraph-image.tsx');

  for (const file of modules) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(
      source,
      /\bgenerateImageMetadata\b/,
      `${path.relative(repoRoot, file)} must not use generateImageMetadata (breaks /opengraph-image URLs)`,
    );
  }
});

test('production routes manifest keeps flat /opengraph-image paths when present', () => {
  const manifestPath = path.join(repoRoot, '.next/routes-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.log('skip: .next/routes-manifest.json missing (run npm run build first)');
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    dynamicRoutes?: { page: string }[];
  };
  const pages = (manifest.dynamicRoutes ?? []).map((route) => route.page);
  const ogPages = pages.filter((page) => page.includes('opengraph-image'));
  assert.ok(ogPages.length > 0, 'expected opengraph-image routes in manifest');

  for (const page of ogPages) {
    assert.doesNotMatch(
      page,
      /__metadata_id__/,
      `route must be /opengraph-image not /opengraph-image/[__metadata_id__]: ${page}`,
    );
  }

  assert.ok(
    ogPages.some((page) => page === '/dashboard/avstemninger/[id]/opengraph-image'),
    'poll detail OG route missing from manifest',
  );
});
