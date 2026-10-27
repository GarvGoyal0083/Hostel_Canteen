import crypto from "crypto";

/**
 * Password hashing with Node's built-in scrypt (no extra packages).
 * Stored format: scrypt$<salt hex>$<hash hex>
 */

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== KEY_LENGTH) return false;
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), KEY_LENGTH);
  return crypto.timingSafeEqual(actual, expected);
}

// Burn the same CPU time as a real check so unknown emails can't be told apart by timing.
const DUMMY_HASH = hashPassword("dummy-password-for-timing");
export function burnPasswordCheck(password: string): void {
  verifyPassword(password, DUMMY_HASH);
}
