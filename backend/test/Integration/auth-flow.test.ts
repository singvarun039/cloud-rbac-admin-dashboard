import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import type { Express } from 'express';
import { AuthService } from '../../src/modules/auth/auth.service';
import * as auditLogService from '../../src/services/auditLog.service';

let app: Express;

const originalLogin = AuthService.login;
const originalRefresh = AuthService.refresh;
const originalLogout = AuthService.logout;
const originalWriteAuditLog = auditLogService.writeAuditLog;

test.before(async () => {
  process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';
  process.env.AUTH_REFRESH_RATE_LIMIT_MAX = '100';

  const mod = await import('../../src/app');
  app = mod.createApp();
});

test.afterEach(() => {
  AuthService.login = originalLogin;
  AuthService.refresh = originalRefresh;
  AuthService.logout = originalLogout;
  (auditLogService as any).writeAuditLog = originalWriteAuditLog;
});

test('auth flow: POST /api/auth/login returns token pair and user data', async () => {
  const auditCalls: Array<Record<string, unknown>> = [];

  AuthService.login = (async () => ({
    accessToken: 'access-123',
    refreshToken: 'refresh-123',
    user: {
      id: 'user-1',
      email: 'demo@example.com',
      name: 'Demo Admin',
    },
  })) as typeof AuthService.login;

  (auditLogService as any).writeAuditLog = async (input: unknown) => {
    auditCalls.push(input as unknown as Record<string, unknown>);
  };

  const res = await request(app)
    .post('/api/auth/login')
    .set('User-Agent', 'supertest')
    .send({ email: 'demo@example.com', password: 'secret123' });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.data.accessToken, 'access-123');
  assert.equal(res.body.data.refreshToken, 'refresh-123');
  assert.deepEqual(res.body.data.user, {
    id: 'user-1',
    email: 'demo@example.com',
    name: 'Demo Admin',
  });
  assert.equal(typeof res.body.requestId, 'string');
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].action, 'LOGIN_SUCCESS');
});

test('auth flow: POST /api/auth/login returns AUTH_INVALID_CREDENTIALS on failure', async () => {
  const auditCalls: Array<Record<string, unknown>> = [];

  AuthService.login = (async () => null) as typeof AuthService.login;

  (auditLogService as any).writeAuditLog = async (input: unknown) => {
    auditCalls.push(input as unknown as Record<string, unknown>);
  };

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'demo@example.com', password: 'wrong-password' });

  assert.equal(res.status, 401);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error.code, 'AUTH_INVALID_CREDENTIALS');
  assert.equal(res.body.error.message, 'Invalid email or password');
  assert.equal(typeof res.body.requestId, 'string');
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].action, 'LOGIN_FAILURE');
});

test('auth flow: POST /api/auth/refresh rotates tokens', async () => {
  AuthService.refresh = (async () => ({
    accessToken: 'access-rotated',
    refreshToken: 'refresh-rotated',
  })) as typeof AuthService.refresh;

  const res = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken: 'refresh-123' });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.data.accessToken, 'access-rotated');
  assert.equal(res.body.data.refreshToken, 'refresh-rotated');
  assert.equal(typeof res.body.requestId, 'string');
});

test('auth flow: POST /api/auth/refresh returns UNAUTHORIZED for invalid refresh tokens', async () => {
  AuthService.refresh = (async () => null) as typeof AuthService.refresh;

  const res = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken: 'bad-refresh-token' });

  assert.equal(res.status, 401);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error.code, 'UNAUTHORIZED');
  assert.equal(res.body.error.message, 'Invalid refresh token');
});

test('auth flow: POST /api/auth/logout returns idempotent success envelope', async () => {
  AuthService.logout = (async () => ({ success: true })) as typeof AuthService.logout;

  const res = await request(app)
    .post('/api/auth/logout')
    .send({ refreshToken: 'refresh-123' });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.data, { success: true });
  assert.equal(typeof res.body.requestId, 'string');
});
