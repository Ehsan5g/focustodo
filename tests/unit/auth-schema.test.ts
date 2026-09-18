import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  registerSchema,
  signInSchema,
} from "@/validation/auth-schema";

/**
 * Unit tests (T007, D4/D12): shared auth schemas — the single Zod source of
 * truth (constitution II). Name 1–80 trimmed; email ≤254 + RFC-lite pattern +
 * normalized; password 8–72 inclusive; no complexity rules on passwords.
 */

const VALID = {
  name: "Ehsan",
  email: "Ehsan@Example.com",
  password: "hunter2hunter2",
};

describe("normalizeEmail (clarified FR-001)", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  John@X.COM  ")).toBe("john@x.com");
  });
});

describe("registerSchema", () => {
  it("accepts valid registration data and stores a normalized email", () => {
    const result = registerSchema.safeParse(VALID);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("ehsan@example.com");
  });

  it("rejects a name over 80 characters and trims a padded one", () => {
    expect(
      registerSchema.safeParse({ ...VALID, name: "x".repeat(81) }).success,
    ).toBe(false);
    const padded = registerSchema.safeParse({ ...VALID, name: "  Ada  " });
    if (padded.success) expect(padded.data.name).toBe("Ada");
  });

  it("rejects an empty name", () => {
    expect(registerSchema.safeParse({ ...VALID, name: "   " }).success).toBe(
      false,
    );
  });

  it("rejects emails over 254 characters", () => {
    const long = `${"a".repeat(250)}@x.com`;
    expect(registerSchema.safeParse({ ...VALID, email: long }).success).toBe(
      false,
    );
  });

  it("rejects malformed emails", () => {
    expect(
      registerSchema.safeParse({ ...VALID, email: "not-an-email" }).success,
    ).toBe(false);
    expect(registerSchema.safeParse({ ...VALID, email: "a@b@c" }).success).toBe(
      false,
    );
    expect(
      registerSchema.safeParse({ ...VALID, email: "a b@x.com" }).success,
    ).toBe(false);
  });

  it("accepts password length 8 and 72, rejects 7 and 73", () => {
    expect(
      registerSchema.safeParse({ ...VALID, password: "a".repeat(8) }).success,
    ).toBe(true);
    expect(
      registerSchema.safeParse({ ...VALID, password: "a".repeat(72) }).success,
    ).toBe(true);
    expect(
      registerSchema.safeParse({ ...VALID, password: "a".repeat(7) }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ ...VALID, password: "a".repeat(73) }).success,
    ).toBe(false);
  });

  it("imposes no complexity rules on passwords", () => {
    expect(
      registerSchema.safeParse({ ...VALID, password: "aaaaaaaa" }).success,
    ).toBe(true);
  });
});

describe("signInSchema", () => {
  it("accepts valid credentials and normalizes the email", () => {
    const result = signInSchema.safeParse({
      email: "  Ada@X.com ",
      password: "hunter2hunter2",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("ada@x.com");
  });

  it("rejects invalid email and out-of-range passwords", () => {
    expect(
      signInSchema.safeParse({ email: "bad", password: "hunter2hunter2" })
        .success,
    ).toBe(false);
    expect(
      signInSchema.safeParse({ email: "a@b.com", password: "a".repeat(7) })
        .success,
    ).toBe(false);
  });
});
