import assert from 'node:assert/strict';
import { getSmtpConfig, isSmtpConfigured } from './smtp-config';

const keys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'] as const;
const original: Partial<Record<(typeof keys)[number], string | undefined>> = {};

for (const key of keys) {
  original[key] = process.env[key];
}

function withSmtpEnv(values: Partial<Record<(typeof keys)[number], string>>, fn: () => void) {
  for (const key of keys) {
    const value = values[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    fn();
  } finally {
    for (const key of keys) {
      const value = original[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

withSmtpEnv({}, () => {
  assert.equal(isSmtpConfigured(), false);
  try {
    getSmtpConfig();
    assert.fail('expected getSmtpConfig to throw when SMTP is missing');
  } catch (error) {
    assert.match(String(error), /SMTP is not configured/);
  }
});

withSmtpEnv(
  {
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_USER: 'user',
    SMTP_PASS: 'pass',
    SMTP_FROM: 'noreply@example.com',
  },
  () => {
    assert.equal(isSmtpConfigured(), true);
    assert.deepEqual(getSmtpConfig(), {
      host: 'smtp.example.com',
      port: 587,
      user: 'user',
      pass: 'pass',
      from: 'noreply@example.com',
    });
  },
);

withSmtpEnv(
  {
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_USER: 'user',
    SMTP_PASS: 'pass',
    SMTP_FROM: '   ',
  },
  () => {
    assert.equal(isSmtpConfigured(), false);
  },
);

console.log('smtp-config tests passed');
