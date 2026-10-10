import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVideoUrl, buildEmbedUrl } from '../../src/lib/video-embed.js';

const ID = 'dQw4w9WgXcQ';

test('parses watch, short, embed and shorts links', () => {
  assert.deepEqual(parseVideoUrl(`https://www.youtube.com/watch?v=${ID}`), { id: ID, start: 0 });
  assert.deepEqual(parseVideoUrl(`https://youtu.be/${ID}`), { id: ID, start: 0 });
  assert.deepEqual(parseVideoUrl(`https://www.youtube.com/embed/${ID}`), { id: ID, start: 0 });
  assert.deepEqual(parseVideoUrl(`https://www.youtube.com/shorts/${ID}`), { id: ID, start: 0 });
});

test('parses start offsets', () => {
  assert.equal(parseVideoUrl(`https://youtu.be/${ID}?t=90`).start, 90);
  assert.equal(parseVideoUrl(`https://www.youtube.com/watch?v=${ID}&t=1m30s`).start, 90);
  assert.equal(parseVideoUrl(`https://www.youtube.com/watch?v=${ID}&start=15`).start, 15);
  assert.equal(parseVideoUrl(`https://www.youtube.com/watch?v=${ID}&t=abc`).start, 0);
});

test('rejects bad ids, hosts, schemes and non-strings', () => {
  assert.equal(parseVideoUrl('https://www.youtube.com/watch?v=short'), null);
  assert.equal(parseVideoUrl(`https://www.youtube.com/watch?v=${ID}x`), null);
  assert.equal(parseVideoUrl(`https://evil.example/watch?v=${ID}`), null);
  assert.equal(parseVideoUrl(`http://www.youtube.com/watch?v=${ID}`), null);
  assert.equal(parseVideoUrl(`javascript:alert(1)//youtube.com/watch?v=${ID}`), null);
  assert.equal(parseVideoUrl(null), null);
  assert.equal(parseVideoUrl(undefined), null);
  assert.equal(parseVideoUrl(42), null);
  assert.equal(parseVideoUrl('not a url'), null);
});

test('builds the privacy-enhanced embed url', () => {
  const url = new URL(buildEmbedUrl({ id: ID, start: 0 }));
  assert.equal(url.host, 'www.youtube-nocookie.com');
  assert.equal(url.pathname, `/embed/${ID}`);
  assert.equal(url.searchParams.get('autoplay'), '1');
  assert.equal(url.searchParams.has('start'), false);
  assert.equal(new URL(buildEmbedUrl({ id: ID, start: 42 })).searchParams.get('start'), '42');
});
