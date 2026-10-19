import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ensureLocalCredentials } from '../scripts/init-local-secrets.mjs';

test('initialization generates independent local credentials and never replaces existing ones', () => {
  const directory = mkdtempSync(join(tmpdir(), 'live-local-test-'));
  try {
    const first = join(directory, 'first', 'local-keys.yaml');
    const second = join(directory, 'second', 'local-keys.yaml');
    assert.equal(ensureLocalCredentials(first), true);
    assert.equal(ensureLocalCredentials(second), true);
    const original = readFileSync(first, 'utf8');
    assert.match(original, /^local_[a-f0-9]{24}: [A-Za-z0-9_-]{64}\n$/);
    assert.notEqual(original, readFileSync(second, 'utf8'));
    assert.equal(ensureLocalCredentials(first), false);
    assert.equal(readFileSync(first, 'utf8'), original);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
