import { describe, expect, it } from 'vitest';
import {
  asRecord,
  extractAccessToken,
  extractErrorMessage,
  extractRefreshToken,
  isStringArray,
  unwrapMeResponse,
  unwrapMeUser,
} from '../../src/auth/authHelpers';

describe('authHelpers', () => {
  it('extracts access and refresh tokens from nested envelopes', () => {
    const payload = {
      data: {
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
      },
    };

    expect(extractAccessToken(payload)).toBe('access-123');
    expect(extractRefreshToken(payload)).toBe('refresh-456');
  });

  it('falls back to a default login error when the server payload is missing', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('Login failed. Please try again.');
  });

  it('prefers the server error message when available', () => {
    const err = {
      response: {
        data: {
          error: {
            message: 'Invalid credentials',
          },
        },
      },
    };

    expect(extractErrorMessage(err)).toBe('Invalid credentials');
  });

  it('unwraps /auth/me responses and tolerates nested user permissions', () => {
    const payload = {
      data: {
        user: {
          id: 'user-1',
          email: 'demo@example.com',
          permissions: ['roles.read'],
        },
      },
    };

    expect(unwrapMeResponse(payload)).toEqual({
      user: { id: 'user-1', email: 'demo@example.com', permissions: ['roles.read'] },
      permissions: ['roles.read'],
    });
  });

  it('exposes the low-level narrowing helpers', () => {
    expect(asRecord({ ok: true })).toEqual({ ok: true });
    expect(asRecord(null)).toBeNull();
    expect(unwrapMeUser({ id: '1', email: 'a@example.com' })).toEqual({
      id: '1',
      email: 'a@example.com',
    });
    expect(unwrapMeUser({ id: 1 })).toBeNull();
    expect(isStringArray(['a', 'b'])).toBe(true);
    expect(isStringArray(['a', 1])).toBe(false);
  });
});
