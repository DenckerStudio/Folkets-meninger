import assert from 'node:assert/strict';
import { getSmtpConfig, isSmtpConfigured } from './smtp-config';

const envKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'] as const;
const original: Record<string, string | undefined> = {};
for (const key of envKeys) {
  original[key] = process.env[key];
}

for (const key of envKeys) {
  delete process.env[key];
}
assert.equal(isSmtpConfigured(), false);

try {
  getSmtpConfig();
  assert.fail('expected getSmtpConfig to throw when SMTP is missing');
} catch (error) {
  assert.match(String(error), /SMTP is not configured/);
}

process.env.SMTP_HOST = 'smtp.example.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'user';
process.env.SMTP_PASS = 'pass';
process.env.SMTP_FROM = 'noreply@example.com';
assert.equal(isSmtpConfigured(), true);
assert.deepEqual(getSmtpConfig(), {
  host: 'smtp.example.com',
  port: 587,
  user: 'user',
  pass: 'pass',
  from: 'noreply@example.com',
});

for (const key of envKeys) {
  if (original[key] === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = original[key];
  }
}

console.log('smtp-config tests passed');
