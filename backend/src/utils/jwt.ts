import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env } from '../config/env';

export type JwtPayload = {
  sub: string; // userId
};

export type RefreshJwtPayload = {
  sub: string; // userId
  jti: string; // unique token id (rotation)
  typ: 'refresh';
};

// Signs a short-lived access token for the given user.
export function signAccessToken(userId: string): string {
  const payload: JwtPayload = { sub: userId };
  const expiresIn = env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'];
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn });
}

// Verifies and normalizes an access token payload.
export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
  if (!decoded?.sub || typeof decoded.sub !== 'string') {
    throw new Error('Invalid token payload');
  }
  return { sub: decoded.sub };
}

// Signs a refresh token and returns its derived expiry.
export function signRefreshToken(userId: string): {
  token: string;
  expiresAt: Date;
} {
  const payload: RefreshJwtPayload = {
    sub: userId,
    jti: randomUUID(),
    typ: 'refresh',
  };
  const expiresIn = env.REFRESH_TOKEN_TTL as jwt.SignOptions['expiresIn'];
  const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn });

  // SECURITY: Derive DB expiry from the signed token's exp claim to avoid TTL parsing bugs.
  const decoded = jwt.decode(token) as jwt.JwtPayload | null;
  if (!decoded?.exp || typeof decoded.exp !== 'number') {
    throw new Error('Failed to derive refresh token expiry');
  }

  return { token, expiresAt: new Date(decoded.exp * 1000) };
}

// Verifies and normalizes a refresh token payload.
export function verifyRefreshToken(token: string): RefreshJwtPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;

  if (!decoded?.sub || typeof decoded.sub !== 'string') {
    throw new Error('Invalid token payload');
  }
  if (!decoded?.jti || typeof decoded.jti !== 'string') {
    throw new Error('Invalid token payload');
  }
  if (decoded.typ !== 'refresh') {
    throw new Error('Invalid token type');
  }

  return { sub: decoded.sub, jti: decoded.jti, typ: 'refresh' };
}
