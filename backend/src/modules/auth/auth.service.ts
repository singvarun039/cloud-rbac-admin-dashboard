import { prisma } from "../../db/prisma";
import { verifyPassword } from "../../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt";
import { hashRefreshToken } from "../../utils/refreshToken";

type LoginInput = { email: string; password: string };

type SessionMeta = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

export class AuthService {
  static async login(input: LoginInput, meta: SessionMeta = {}) {
    const email = input.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        passwordHash: true,
      },
    });

    // Avoid leaking which part failed
    if (!user || user.isActive !== true) {
      return null;
    }

    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) return null;

    const accessToken = signAccessToken(user.id);

    const { token: refreshToken, expiresAt } = signRefreshToken(user.id);

    // SECURITY: Store only the hash of the refresh token. Never persist the token itself.
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashRefreshToken(refreshToken),
        expiresAt,
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ipAddress ?? null,
      },
    });

    const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name },
    };
  }

  static async refresh(refreshToken: string, meta: SessionMeta = {}) {
    // 1) Verify signature/expiry first (cheap reject before DB).
    const payload = verifyRefreshToken(refreshToken);

    // 2) Hash incoming token to match DB row (no plaintext comparisons).
    const refreshTokenHash = hashRefreshToken(refreshToken);

    const session = await prisma.session.findUnique({
      where: { refreshTokenHash },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true },
    });

    const now = new Date();

    // 3) Missing/revoked/expired session means token reuse or invalid token.
    if (!session || session.revokedAt || session.expiresAt <= now) {
      return null;
    }

    // 4) Rotate refresh token: revoke old session + mint a new one.
    // SECURITY: Use updateMany with revokedAt=null guard to ensure a refresh token is single-use.
    try {
      const rotated = await prisma.$transaction(async (tx) => {
        const revokeResult = await tx.session.updateMany({
          where: { id: session.id, revokedAt: null },
          data: { revokedAt: now },
        });

        if (revokeResult.count !== 1) {
          // Token was already used/revoked (reuse attempt).
          throw new Error("REFRESH_TOKEN_REUSED");
        }

        const { token: newRefreshToken, expiresAt: newExpiresAt } = signRefreshToken(payload.sub);
        const newSession = await tx.session.create({
          data: {
            userId: payload.sub,
            refreshTokenHash: hashRefreshToken(newRefreshToken),
            expiresAt: newExpiresAt,
            userAgent: meta.userAgent ?? null,
            ipAddress: meta.ipAddress ?? null,
          },
          select: { id: true },
        });

        await tx.session.update({
          where: { id: session.id },
          data: { replacedBySessionId: newSession.id },
        });

        const newAccessToken = signAccessToken(payload.sub);

        return { accessToken: newAccessToken, refreshToken: newRefreshToken };
      });

      return rotated;
    } catch {
      return null;
    }
  }

  static async logout(refreshToken: string) {
    // SECURITY: Don't require the token to be valid JWT to revoke; we revoke by hash if present.
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const now = new Date();

    await prisma.session.updateMany({
      where: { refreshTokenHash, revokedAt: null },
      data: { revokedAt: now },
    });

    // Idempotent success response to avoid leaking whether a session existed.
    return { success: true };
  }

  static async getMe(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, isActive: true },
    });
  }
}
