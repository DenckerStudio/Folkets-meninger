import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { createByokPinnedFetch } from './pinned-fetch.server';

const ALLOWED_BYOK_PORTS = [1234, 11434, 11435, 80] as const;

async function listenLocalhost(): Promise<{ server: Server; port: number; close: () => Promise<void> }> {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('byok-pin-ok');
  });
  let bound = false;
  for (const port of ALLOWED_BYOK_PORTS) {
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => resolve());
      });
      bound = true;
      break;
    } catch {
      server.removeAllListeners('error');
    }
  }
  if (!bound) {
    throw new Error('could not bind BYOK integration server on an allowed port');
  }
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('expected TCP server address');
  }
  return {
    server,
    port: address.port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function main() {
  const { port, close } = await listenLocalhost();
  const baseUrl = `http://127.0.0.1:${port}/v1`;
  const targetUrl = `http://127.0.0.1:${port}/api/tags`;

  try {
    const blocked = createByokPinnedFetch({ isAdmin: false }, baseUrl);
    await assert.rejects(async () => {
      await blocked(targetUrl);
    });

    const allowed = createByokPinnedFetch(
      {
        isAdmin: true,
        allowlistOrigins: [`http://127.0.0.1:${port}`],
      },
      baseUrl,
    );
    const response = await allowed(targetUrl);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'byok-pin-ok');
  } finally {
    await close();
  }

  console.log('byok/pinned-fetch.integration.test.ts: ok');
}

void main();
