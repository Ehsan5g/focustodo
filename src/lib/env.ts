import { z } from "zod";

/**
 * Environment contract (contracts/environment.md).
 *
 * Validated once at module load: on failure the process prints ONE actionable
 * message naming every problem and exits — never a raw stack trace (FR-012).
 *
 * Extension convention: each later feature that needs new configuration MUST
 * extend this schema and update `.env.example` in the same change.
 */
const envSchema = z.object({
  DATABASE_URL: z
    .string({ error: "required" })
    .pipe(z.url("must be a valid URL")),
  // Auth.js cookie-signing secret (feature 002-user-auth, research D13).
  // Minimum 32 characters keeps the HMAC key comfortably strong; a missing
  // or weak value exits startup with ONE actionable message (FR-012).
  AUTH_SECRET: z
    .string({ error: "required" })
    .min(32, "must be at least 32 characters"),
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
});

export type Env = z.infer<typeof envSchema>;

function formatProblems(issues: z.ZodError["issues"]): string[] {
  return issues.map((issue) => {
    const key = issue.path.length > 0 ? issue.path.join(".") : "(unknown)";
    return `- ${key}: ${issue.message}`;
  });
}

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  NODE_ENV: process.env.NODE_ENV,
});

if (!parsed.success) {
  // process.stderr.write instead of console: keeps production code free of
  // console statements (FR-014) while still printing the fail-fast diagnostic.
  process.stderr.write(
    `Invalid environment configuration:\n${formatProblems(parsed.error.issues).join("\n")}\nFix the variable(s) above (see .env.example) and restart.\n`,
  );
  process.exit(1);
}

export const env = parsed.data;
