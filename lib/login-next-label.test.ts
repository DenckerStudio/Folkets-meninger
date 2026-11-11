import assert from 'node:assert/strict';
import { labelForLoginNext } from './login-next-label';

describe('labelForLoginNext', () => {
  it('should return exact match for dashboard', () => {
    assert.strictEqual(labelForLoginNext('/dashboard'), 'dashboardet');
  });

  it('should return exact match for utforsk', () => {
    assert.strictEqual(labelForLoginNext('/utforsk'), 'Utforsk');
  });

  it('should return prefix match for avstemninger/123', () => {
    assert.strictEqual(labelForLoginNext('/avstemninger/123'), 'avstemningen');
  });

  it('should return prefix match for horinger/456', () => {
    assert.strictEqual(labelForLoginNext('/horinger/456'), 'høringen');
  });

  it('should return prefix match for /dashboard/sak/789', () => {
    assert.strictEqual(labelForLoginNext('/dashboard/sak/789'), 'saken');
  });

  it('should return prefix match for /folkets-meninger/012', () => {
    assert.strictEqual(labelForLoginNext('/folkets-meninger/012'), 'meningen');
  });

  it('should return prefix match for /politikere/345', () => {
    assert.strictEqual(labelForLoginNext('/politikere/345'), 'politikeren');
  });

  it('should return prefix match for /admin/678', () => {
    assert.strictEqual(labelForLoginNext('/admin/678'), 'admin');
  });

  it('should strip query and return exact match for /dashboard?query=1', () => {
    assert.strictEqual(labelForLoginNext('/dashboard?query=1'), 'dashboardet');
  });

  it('should strip hash and return exact match for /dashboard#hash', () => {
    assert.strictEqual(labelForLoginNext('/dashboard#hash'), 'dashboardet');
  });

  it('should return unchanged for unknown path', () => {
    assert.strictEqual(labelForLoginNext('/unknown/path'), '/unknown/path');
  });
});
