/**
 * One-off favicon generator. Run from repo root:
 *   npm install --no-save sharp png-to-ico
 *   node scripts/generate-favicons.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'favicon/logo-source.jpg');

const WHITE = 250;

function floodFillBackgroundAlpha({ data, width, height, channels }) {
  const visited = new Uint8Array(width * height);
  const queue = [];

  const idx = (x, y) => (y * width + x) * channels;
  const isWhite = (x, y) => {
    const i = idx(x, y);
    return data[i] >= WHITE && data[i + 1] >= WHITE && data[i + 2] >= WHITE;
  };
  const push = (x, y) => {
    const p = y * width + x;
    if (visited[p]) return;
    if (!isWhite(x, y)) return;
    visited[p] = 1;
    queue.push([x, y]);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (queue.length > 0) {
    const [x, y] = queue.pop();
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (visited[y * width + x]) {
        const i = idx(x, y);
        data[i + 3] = 0;
      }
    }
  }
}

async function buildMasterSquare() {
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  floodFillBackgroundAlpha({
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
  });

  let pipeline = sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  });

  const trimmed = await pipeline.trim({ threshold: 1 }).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const canvas = Math.max(meta.width, meta.height);
  const top = Math.floor((canvas - meta.height) / 2);
  const bottom = canvas - meta.height - top;
  const left = Math.floor((canvas - meta.width) / 2);
  const right = canvas - meta.width - left;

  return sharp(trimmed)
    .extend({
      top,
      bottom,
      left,
      right,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function resize(master, size) {
  return sharp(master).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

async function appleIcon(master, size = 180) {
  const logo = await sharp(master)
    .resize(Math.round(size * 0.88), Math.round(size * 0.88), {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();
  const meta = await sharp(logo).metadata();
  const top = Math.floor((size - meta.height) / 2);
  const left = Math.floor((size - meta.width) / 2);
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logo, top, left }])
    .png()
    .toBuffer();
}

async function main() {
  const master = await buildMasterSquare();
  await fs.mkdir(path.join(root, 'favicon'), { recursive: true });
  await fs.writeFile(path.join(root, 'favicon/logo-master.png'), master);

  const sizes = [16, 32, 48, 192, 512];
  const pngBySize = {};
  for (const s of sizes) {
    pngBySize[s] = await resize(master, s);
  }
  const apple = await appleIcon(master, 180);

  const appDir = path.join(root, 'app');
  const publicDir = path.join(root, 'public');
  const artifactsDir = '/opt/cursor/artifacts';

  await fs.writeFile(path.join(appDir, 'icon.png'), pngBySize[32]);
  await fs.writeFile(path.join(appDir, 'apple-icon.png'), apple);

  const ico = await pngToIco([pngBySize[16], pngBySize[32], pngBySize[48]]);
  await fs.writeFile(path.join(appDir, 'favicon.ico'), ico);
  await fs.writeFile(path.join(publicDir, 'favicon.ico'), ico);

  await fs.writeFile(path.join(publicDir, 'icon-192.png'), pngBySize[192]);
  await fs.writeFile(path.join(publicDir, 'icon-512.png'), pngBySize[512]);

  const preview = await sharp({
    create: {
      width: 16 + 32 + 180 + 40,
      height: 200,
      channels: 4,
      background: { r: 240, g: 240, b: 240, alpha: 1 },
    },
  })
    .composite([
      { input: pngBySize[16], top: 92, left: 10 },
      { input: pngBySize[32], top: 84, left: 36 },
      { input: apple, top: 10, left: 90 },
    ])
    .png()
    .toBuffer();

  await fs.mkdir(artifactsDir, { recursive: true });
  await fs.writeFile(path.join(artifactsDir, 'favicon-preview-16-32-180.png'), preview);
  for (const s of [16, 32, 180]) {
    const buf = s === 180 ? apple : s === 32 ? pngBySize[32] : pngBySize[16];
    await fs.writeFile(path.join(artifactsDir, `favicon-${s}.png`), buf);
  }

  console.log('Generated favicons OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
