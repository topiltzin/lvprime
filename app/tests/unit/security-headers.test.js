import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SECURITY_HEADERS, applySecurityHeaders } from '../../server/security-headers.js';

test('vercel.json sends the same security headers as the Node server', () => {
  const vercel = JSON.parse(fs.readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  const catchAll = vercel.headers.find((h) => h.source === '/(.*)');
  assert.ok(catchAll, 'vercel.json needs a /(.*) headers entry');
  const fromVercel = Object.fromEntries(catchAll.headers.map((h) => [h.key, h.value]));
  assert.deepEqual(fromVercel, SECURITY_HEADERS);
});

test('applySecurityHeaders keeps a header a handler already set', () => {
  const headers = new Map([['X-Frame-Options', 'SAMEORIGIN']]);
  const res = {
    hasHeader: (name) => headers.has(name),
    setHeader: (name, value) => headers.set(name, value),
  };
  applySecurityHeaders(res);
  assert.equal(headers.get('X-Frame-Options'), 'SAMEORIGIN');
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
});
