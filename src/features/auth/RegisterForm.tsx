"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  registerAction,
  type ActionResult,
} from "@/server/actions/auth-actions";

/**
 * RegisterForm (feature 002-user-auth T019, D10): labeled fields, inline
 * field errors, pending submit state, password cleared on failure while
 * name/email are preserved. Success navigates to the action's `redirectTo`.
 *
 * Fields are CONTROLLED: React auto-resets uncontrolled inputs after a
 * server-action submission, which would wipe the preserved name/email
 * (FR-014). Controlled state keeps them intact; the password state is
 * explicitly cleared on any non-success result.
 */

const INITIAL_ACTION_STATE = null;

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Action wrapper: on any non-success result the password field is cleared
  // while name/email are preserved (FR-014, D10) — their state is untouched.
  const runRegisterAction = useCallback(
    async (
      prev: ActionResult | null,
      formData: FormData,
    ): Promise<ActionResult> => {
      const result = await registerAction(prev, formData);
      if (result.status !== "success") {
        setPassword("");
      }
      return result;
    },
    [],
  );

  const [state, formAction, isPending] = useActionState(
    runRegisterAction,
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
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Register with your name, email, and a password (8–72 characters).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="register-name">Name</label>
            <input
              id="register-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={errorFor("name") ? true : false}
              aria-describedby={
                errorFor("name") ? "register-name-error" : undefined
              }
              className="border-border bg-background focus-visible:outline-ring rounded-md border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
            />
            {errorFor("name") && (
              <p id="register-name-error" className="text-sm text-red-600">
                {errorFor("name")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={errorFor("email") ? true : false}
              aria-describedby={
                errorFor("email") ? "register-email-error" : undefined
              }
              className="border-border bg-background focus-visible:outline-ring rounded-md border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
            />
            {errorFor("email") && (
              <p id="register-email-error" className="text-sm text-red-600">
                {errorFor("email")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={errorFor("password") ? true : false}
              aria-describedby={
                errorFor("password") ? "register-password-error" : undefined
              }
              className="border-border bg-background focus-visible:outline-ring rounded-md border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
            />
            {errorFor("password") && (
              <p id="register-password-error" className="text-sm text-red-600">
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
            {isPending ? "Creating account…" : "Create account"}
          </Button>

          <p className="text-muted-foreground text-sm">
            <Link href="/sign-in" className="underline">
              Already have an account? Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
