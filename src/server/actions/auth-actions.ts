"use server";

import { AuthError } from "next-auth";

import { hashPassword } from "@/server/auth/password";
import { signIn, signOut } from "@/server/auth/auth";
import { db } from "@/server/db";
import { registerSchema, signInSchema } from "@/validation/auth-schema";

/**
 * Auth server actions (feature 002-user-auth, contracts/server-actions.md).
 *
 * Every action follows the five-step contract — (1) Validate, (2)
 * Authenticate, (3) Authorize, (4) Execute, (5) Return — with the steps
 * visible, in order, in the body. Results are the predictable `ActionResult`
 * union ONLY; raw database objects never cross the client boundary
 * (constitution I). Nothing sensitive (passwords, hash material, session
 * ids) is ever logged (contract non-negotiables).
 */

export type FieldError = {
  field: "name" | "email" | "password";
  message: string;
};

export type ActionResult =
  | { status: "success"; redirectTo: string }
  | { status: "validation_error"; fieldErrors: FieldError[] }
  | { status: "failure"; message: string };

const GENERIC_ERROR = "Something went wrong. Please try again.";
const DUPLICATE_EMAIL_ERROR = {
  field: "email" as const,
  message: "This email is already registered. Try signing in instead.",
};

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function zodToFieldErrors(error: unknown): FieldError[] {
  // zod v4: dedupe by first issue per path so one message lands per field.
  const issues = (
    error as { issues: { path: PropertyKey[]; message: string }[] }
  ).issues;
  const seen = new Set<string>();
  const fieldErrors: FieldError[] = [];
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (seen.has(key)) continue;
    seen.add(key);
    fieldErrors.push({
      field: key as FieldError["field"],
      message: issue.message,
    });
  }
  return fieldErrors;
}

export async function registerAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // (1) Validate — the server re-validates every input (constitution I);
  // the shared Zod schema trims, bounds, normalizes the email.
  const parsed = registerSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "validation_error",
      fieldErrors: zodToFieldErrors(parsed.error),
    };
  }
  const { name, email, password } = parsed.data;

  try {
    // (2) Authenticate — N/A: public action.
    // (3) Authorize — N/A: creating one's own account is always allowed.

    // (4) Execute — normalized duplicate check first (any case/whitespace
    // variant collides), then hash + create, then the first sign-in.
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return {
        status: "validation_error",
        fieldErrors: [DUPLICATE_EMAIL_ERROR],
      };
    }

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: { name, email, passwordHash },
      select: { id: true },
    });

    // Server-side credentials sign-in creates the first Session row and the
    // session cookie — registration and sign-in share one path (contract).
    await signIn("credentials", { email, password, redirect: false });
    if (!user.id) return { status: "failure", message: GENERIC_ERROR };

    // (5) Return — `{ ok }`-style success only; no User object.
    return { status: "success", redirectTo: "/" };
  } catch (error) {
    // A concurrent registration with the same normalized email (double
    // submit, two tabs) loses the unique race here — same friendly field
    // error as the pre-check above.
    if (isUniqueViolation(error)) {
      return {
        status: "validation_error",
        fieldErrors: [DUPLICATE_EMAIL_ERROR],
      };
    }
    if (error instanceof AuthError) {
      return { status: "failure", message: GENERIC_ERROR };
    }
    throw error;
  }
}

export async function signInAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // (1) Validate — shared signInSchema (email normalized, password bounds).
  const parsed = signInSchema.safeParse({
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "validation_error",
      fieldErrors: zodToFieldErrors(parsed.error),
    };
  }
  const { email, password } = parsed.data;

  // (2) Authenticate — N/A: public by definition.
  // (3) Authorize — N/A.

  // (4) Execute — the Credentials provider in auth.ts owns unknown-email
  // timing equalization (DUMMY scrypt verification) and password checking;
  // both failures arrive here as one indistinguishable AuthError.
  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      // (5) Return — ONE generic message for unknown email AND wrong
      // password; never distinct, never technical (FR-005).
      return { status: "failure", message: "Invalid email or password" };
    }
    throw error;
  }

  // (5) Return — the protected area; `next` destination honoring arrives
  // with US3's redirect guard.
  return { status: "success", redirectTo: "/" };
}

export async function signOutAction(): Promise<ActionResult> {
  // (1) Validate — no input.
  // (2) Authenticate — resolve current session, if any (signOut is a no-op
  // without one).
  // (3) Authorize — signing out one's own session is always allowed.

  // (4) Execute — the JWT cookie is cleared here; the DB Session row is
  // deleted by the sign-out flow wired to the session service (US2/T026).
  await signOut();

  // (5) Return — the button navigates to the sign-in view.
  return { status: "success", redirectTo: "/sign-in" };
}
