import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

/**
 * Unit tests (T009, D3/D12): scrypt password service. Format
 * `scrypt$N$r$p$<salt-b64>$<hash-b64>`; timingSafeEqual verification;
 * malformed stored hashes rejected without throwing; unique salts.
 */

describe("password service (research D3)", () => {
  it("round-trips hash → verify", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(
      true,
    );
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("right");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("produces the self-describing scrypt$ format", async () => {
    const hash = await hashPassword("anything");
    const parts = hash.split("$");
    expect(parts).toHaveLength(6); // scrypt, N, r, p, salt, hash
    expect(parts[0]).toBe("scrypt");
    expect(parts[1]).toBe("16384");
    expect(parts[2]).toBe("8");
    expect(parts[3]).toBe("1");
  });

  it("uses unique salts — two hashes of the same password differ", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("rejects malformed stored hashes without throwing", async () => {
    await expect(verifyPassword("pw", "")).resolves.toBe(false);
    await expect(verifyPassword("pw", "garbage")).resolves.toBe(false);
    await expect(verifyPassword("pw", "scrypt$1$2$3")).resolves.toBe(false);
    await expect(
      verifyPassword("pw", "bcrypt$16384$8$1$aaa$bbb"),
    ).resolves.toBe(false);
  });
});
