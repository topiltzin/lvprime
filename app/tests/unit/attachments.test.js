import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AttachmentNotFoundError,
  assertValidRelativePath,
  contentTypeFor,
  sanitizeFileName,
} from '../../server/lib/attachments.js';

test('sanitizeFileName keeps a Storage-safe ASCII name and the extension', () => {
  assert.equal(sanitizeFileName('Semana 1 – Pérez.PDF'), 'Semana-1-Perez.pdf');
  assert.equal(sanitizeFileName('C:\\fakepath\\plan (v2).pdf'), 'plan-v2.pdf');
  assert.equal(sanitizeFileName('../../etc/passwd'), 'passwd');
  assert.equal(sanitizeFileName('---'), '');
  assert.equal(sanitizeFileName(''), '');
});

test('assertValidRelativePath rejects traversal and empty segments', () => {
  assert.doesNotThrow(() => assertValidRelativePath('plans/semana1.pdf'));
  for (const bad of ['', '../x.pdf', 'plans/../../x.pdf', '/abs.pdf', 'a//b.pdf', 'a\\b.pdf', './x.pdf']) {
    assert.throws(() => assertValidRelativePath(bad), AttachmentNotFoundError, bad);
  }
});

test('contentTypeFor knows the attachable types and nothing else', () => {
  assert.equal(contentTypeFor('plans/semana1.PDF'), 'application/pdf');
  assert.equal(contentTypeFor('foto.jpeg'), 'image/jpeg');
  assert.equal(contentTypeFor('script.js'), null);
  assert.equal(contentTypeFor('noext'), null);
});
