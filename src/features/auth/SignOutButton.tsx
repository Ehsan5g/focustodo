"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/server/actions/auth-actions";

/**
 * SignOutButton (feature 002-user-auth T027, D10): calls the `signOut`
 * server action — the Session row delete is the authoritative revocation —
 * then navigates to the sign-in view. Shows a pending state while the
 * action runs.
 */
export function SignOutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await signOutAction();
          router.push("/sign-in");
        })
      }
    >
      {isPending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
