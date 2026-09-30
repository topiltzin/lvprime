import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PayloadTooLargeError, readJsonBody } from '../../server/http.js';

function fakeRequest(chunks) {
  const req = new EventEmitter();
  req.resume = () => {};
  setImmediate(() => {
    for (const chunk of chunks) req.emit('data', chunk);
    req.emit('end');
  });
  return req;
}

test('readJsonBody keeps a multi-byte character split across chunks', async () => {
  const buf = Buffer.from(JSON.stringify({ content: 'Progresión Semanal · niño' }));
  const cut = buf.indexOf(0xc3) + 1; // inside the 2-byte "ó"
  const body = await readJsonBody(fakeRequest([buf.subarray(0, cut), buf.subarray(cut)]));
  assert.deepEqual(body, { content: 'Progresión Semanal · niño' });
});

test('readJsonBody returns {} for an empty body and rejects bad JSON and oversized bodies', async () => {
  assert.deepEqual(await readJsonBody(fakeRequest([])), {});
  await assert.rejects(readJsonBody(fakeRequest([Buffer.from('{nope')])), SyntaxError);
  await assert.rejects(readJsonBody(fakeRequest([Buffer.alloc(1024 * 1024 + 1, 0x20)])), PayloadTooLargeError);
});
