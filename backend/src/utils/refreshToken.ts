import { createHmac } from "crypto";
import { env } from "../config/env";

// Hashes a refresh token before it is stored or compared.
export function hashRefreshToken(refreshToken: string): string {
  // SECURITY (non-negotiable): Refresh tokens must never be stored in plaintext.
  // We store a deterministic HMAC hash so we can look up the session by hash.
  return createHmac("sha256", env.REFRESH_TOKEN_HASH_SECRET)
    .update(refreshToken)
    .digest("hex");
}
