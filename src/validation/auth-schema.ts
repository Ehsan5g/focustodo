import { z } from "zod";

/**
 * Shared auth schemas (feature 002-user-auth, D4) — the single Zod source of
 * truth for registration and sign-in, shared between client and server
 * (constitution II). The server re-validates every action input even though
 * the client also validates.
 *
 * Limits (spec clarifications #2 and #4, data-model.md):
 * - name: 1–80 characters, trimmed
 * - email: ≤254 characters (RFC-aligned limit), RFC-lite pattern, normalized
 *   (trimmed + lowercased) so `John@X.com` and `john@x.com` are the same address
 * - password: 8–72 characters inclusive (72 aligns with the byte limit of
 *   common one-way password hash algorithms so hashing never truncates);
 *   no complexity rules (spec decision)
 */

export const EMAIL_MAX_LENGTH = 254;
export const NAME_MAX_LENGTH = 80;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

/** RFC-lite email pattern: local@domain.tld, no spaces, single @. */
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const emailSchema = z
  .string({ error: "Email is required" })
  .trim()
  .max(EMAIL_MAX_LENGTH, `Email must be at most ${EMAIL_MAX_LENGTH} characters`)
  .pipe(z.email("Please enter a valid email address"))
  .transform(normalizeEmail)
  .refine((value) => emailPattern.test(value), {
    message: "Please enter a valid email address",
  });

const passwordSchema = z
  .string({ error: "Password is required" })
  .min(
    PASSWORD_MIN_LENGTH,
    `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  )
  .max(
    PASSWORD_MAX_LENGTH,
    `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
  );

export const registerSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .trim()
    .min(1, "Please enter your name")
    .max(NAME_MAX_LENGTH, `Name must be at most ${NAME_MAX_LENGTH} characters`),
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
