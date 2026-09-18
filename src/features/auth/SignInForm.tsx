"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signInAction, type ActionResult } from "@/server/actions/auth-actions";

/**
 * SignInForm (feature 002-user-auth T025, D10): labeled fields, inline field
 * errors, ONE generic failure banner for any credential failure (FR-005),
 * pending submit state, password cleared on failure while email is
 * preserved. Success navigates to the action's `redirectTo` (the `returnTo`
 * destination honored AS-IS — clarified FR-008).
 *
 * Fields are CONTROLLED: React auto-resets uncontrolled inputs after a
 * server-action submission, which would wipe the preserved email (FR-014).
 */

const INITIAL_ACTION_STATE = null;

export function SignInForm({ returnTo }: { returnTo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Action wrapper: on any non-success result the password field is cleared
  // while the email is preserved (FR-014, D10).
  const runSignInAction = useCallback(
    async (
      prev: ActionResult | null,
      formData: FormData,
    ): Promise<ActionResult> => {
      const result = await signInAction(prev, formData);
      if (result.status !== "success") {
        setPassword("");
      }
      return result;
    },
    [],
  );

  const [state, formAction, isPending] = useActionState(
    runSignInAction,
    INITIAL_ACTION_STATE,
  );

  useEffect(() => {
    if (state?.status === "success") {
      router.push(state.redirectTo);
    }
  }, [state, router]);

  const fieldErrors =
    state?.status === "validation_error" ? state.fieldErrors : [];
  const errorFor = (field: string) =>
    fieldErrors.find((fieldError) => fieldError.field === field)?.message;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in with your email and password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          {/* The return destination rides along to the action; the US3 guard
              populates it from `?next=`. */}
          <input type="hidden" name="returnTo" value={returnTo ?? ""} />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="sign-in-email">Email</label>
            <input
              id="sign-in-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={errorFor("email") ? true : false}
              aria-describedby={
                errorFor("email") ? "sign-in-email-error" : undefined
              }
              className="border-border bg-background focus-visible:outline-ring rounded-md border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
            />
            {errorFor("email") && (
              <p id="sign-in-email-error" className="text-sm text-red-600">
                {errorFor("email")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="sign-in-password">Password</label>
            <input
              id="sign-in-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={errorFor("password") ? true : false}
              aria-describedby={
                errorFor("password") ? "sign-in-password-error" : undefined
              }
              className="border-border bg-background focus-visible:outline-ring rounded-md border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
            />
            {errorFor("password") && (
              <p id="sign-in-password-error" className="text-sm text-red-600">
                {errorFor("password")}
              </p>
            )}
          </div>

          {state?.status === "failure" && (
            <p role="alert" className="text-sm text-red-600">
              {state.message}
            </p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? "Signing in…" : "Sign in"}
          </Button>

          <p className="text-muted-foreground text-sm">
            <Link href="/register" className="underline">
              Need an account? Register
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
