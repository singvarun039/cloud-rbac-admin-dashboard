import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

// Hashes a plaintext password for storage.
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

// Verifies a plaintext password against its stored hash.
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
