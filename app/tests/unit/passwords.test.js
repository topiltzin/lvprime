import test from 'node:test';
import assert from 'node:assert/strict';
import { isStrongPassword, validateNewPassword } from '../../server/auth.js';

const ok = { currentPassword: 'Default123', newPassword: 'Mine4ever', confirmPassword: 'Mine4ever' };

test('a valid change has no field errors', () => {
  assert.deepEqual(validateNewPassword(ok), {});
});

test('rejects short, letterless and numberless passwords', () => {
  for (const bad of ['a1b2c3', '12345678', 'abcdefgh', '']) {
    assert.ok(!isStrongPassword(bad), bad);
    const fields = validateNewPassword({ ...ok, newPassword: bad, confirmPassword: bad });
    assert.ok(fields.newPassword, bad);
  }
});

test('accepts accented letters', () => {
  assert.ok(isStrongPassword('contraseña1'));
});

test('rejects the same password as the current one', () => {
  const fields = validateNewPassword({ ...ok, newPassword: 'Default123', confirmPassword: 'Default123' });
  assert.ok(fields.newPassword);
});

test('rejects a mismatched confirmation', () => {
  const fields = validateNewPassword({ ...ok, confirmPassword: 'Other1234' });
  assert.ok(fields.confirmPassword);
  assert.equal(fields.newPassword, undefined);
});
