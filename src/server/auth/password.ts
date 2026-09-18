import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing service (feature 002-user-auth, research D3).
 *
 * Node built-in `crypto.scrypt` — zero new runtime dependencies
 * (constitution: no unnecessary libraries). OWASP-aligned parameters
 * (N=16384, r=8, p=1), 64-byte derived key, 16-byte random salt.
 *
 * Storage format (self-describing, enables future parameter upgrades):
 *   scrypt$N$r$p$<salt-b64>$<hash-b64>
 *
 * Verification uses `crypto.timingSafeEqual` after a length check.
 * Plaintext passwords exist only as transient call arguments — never in
 * storage, logs, or client-visible responses (FR-002).
 */

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem?: number },
) => Promise<Buffer>;

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
    ...SCRYPT_PARAMS,
    // 128 * N * r is the theoretical maxmem need; headroom avoids the
    // default 32 MiB cap on constrained environments.
    maxmem: 128 * SCRYPT_PARAMS.N * SCRYPT_PARAMS.r * 2,
  });
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString("base64")}$${derivedKey.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number.parseInt(parts[1] ?? "", 10);
  const r = Number.parseInt(parts[2] ?? "", 10);
  const p = Number.parseInt(parts[3] ?? "", 10);
  const salt = Buffer.from(parts[4] ?? "", "base64");
  const expected = Buffer.from(parts[5] ?? "", "base64");
  if (
    !Number.isFinite(N) ||
    !Number.isFinite(r) ||
    !Number.isFinite(p) ||
    salt.length === 0 ||
    expected.length === 0
  ) {
    return false;
  }
  try {
    const derivedKey = await scrypt(password, salt, expected.length, {
      N,
      r,
      p,
      maxmem: 128 * N * r * 2,
    });
    return (
      derivedKey.length === expected.length &&
      timingSafeEqual(derivedKey, expected)
    );
  } catch {
    return false;
  }
}
