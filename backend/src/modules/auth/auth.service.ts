import { prisma } from "../../db/prisma";
import { verifyPassword } from "../../utils/password";
import { signAccessToken } from "../../utils/jwt";

type LoginInput = { email: string; password: string };

export class AuthService {
  static async login(input: LoginInput) {
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

    const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;

    return {
      accessToken,
      user: { id: user.id, email: user.email, name },
    };
  }

  static async getMe(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, isActive: true },
    });
  }
}
