import test from 'node:test';
import assert from 'node:assert/strict';
import { testOrigin, assertLocalTestLink } from './target.mjs';

test('browser QA defaults to a loopback target and requires explicit remote testing', () => {
  assert.equal(testOrigin('http://localhost:3000'), 'http://localhost:3000');
  assert.throws(() => testOrigin('https://example.test', false));
  assert.equal(testOrigin('https://example.test', true), 'https://example.test');
  assert.throws(() => testOrigin('https://user:password@example.test', true));
  assert.throws(() => testOrigin('http://localhost:3000/extra'));
});

test('a stale meeting link cannot redirect local QA to another origin', () => {
  assertLocalTestLink('http://localhost:3000/m/abc-defg-hij', 'http://localhost:3000');
  assert.throws(() => assertLocalTestLink('https://example.test/m/abc-defg-hij', 'http://localhost:3000'));
});
