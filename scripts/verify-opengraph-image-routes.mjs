#!/usr/bin/env node
/**
 * After `npm run build`, ensure OG image routes stay at …/opengraph-image (not …/opengraph-image/[__metadata_id__]).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, '.next/routes-manifest.json');

if (!fs.existsSync(manifestPath)) {
  console.error('verify-opengraph-image-routes: missing .next/routes-manifest.json — run npm run build first');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const pages = (manifest.dynamicRoutes ?? []).map((route) => route.page);
const ogPages = pages.filter((page) => page.includes('opengraph-image'));

if (ogPages.length === 0) {
  console.error('verify-opengraph-image-routes: no opengraph-image routes in manifest');
  process.exit(1);
}

const bad = ogPages.filter((page) => page.includes('__metadata_id__'));
if (bad.length > 0) {
  console.error('verify-opengraph-image-routes: metadata-id OG routes break share URLs:');
  for (const page of bad) console.error(`  - ${page}`);
  process.exit(1);
}

const required = '/dashboard/avstemninger/[id]/opengraph-image';
if (!ogPages.includes(required)) {
  console.error(`verify-opengraph-image-routes: missing ${required}`);
  process.exit(1);
}

console.log(`verify-opengraph-image-routes: ok (${ogPages.length} flat opengraph-image routes)`);
