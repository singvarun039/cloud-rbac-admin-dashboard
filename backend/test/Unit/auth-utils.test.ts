import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../../src/utils/password';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../src/utils/jwt';
import { hashRefreshToken } from '../../src/utils/refreshToken';

test('password helpers hash and verify plaintext passwords', async () => {
  const password = 'P@ssw0rd!2026';
  const hash = await hashPassword(password);

  assert.notEqual(hash, password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('access token helpers sign and verify the subject', () => {
  const token = signAccessToken('user-123');
  const payload = verifyAccessToken(token);

  assert.equal(typeof token, 'string');
  assert.equal(payload.sub, 'user-123');
});

test('refresh token helpers sign and verify refresh payloads', () => {
  const { token, expiresAt } = signRefreshToken('user-456');
  const payload = verifyRefreshToken(token);

  assert.equal(payload.sub, 'user-456');
  assert.equal(payload.typ, 'refresh');
  assert.equal(typeof payload.jti, 'string');
  assert.equal(payload.jti.length > 0, true);
  assert.equal(expiresAt instanceof Date, true);
  assert.equal(Number.isNaN(expiresAt.getTime()), false);
});

test('refresh token hashing is deterministic and non-plaintext', () => {
  const token = 'sample-refresh-token';
  const a = hashRefreshToken(token);
  const b = hashRefreshToken(token);
  const c = hashRefreshToken('different-token');

  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a, token);
  assert.match(a, /^[a-f0-9]{64}$/);
});
