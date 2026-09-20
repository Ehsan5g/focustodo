import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ProtectedNav } from "@/components/layout/protected-nav";
import { SignOutButton } from "@/features/auth/SignOutButton";
import { resolveSession } from "@/server/auth/session";

/**
 * Protected layout (F002 T028 + T032): the AUTHORITATIVE guard (D8, D9).
 * The DB Session row decides — the middleware's coarse JWT check is advisory
 * only. Missing/invalid session → `/sign-in?next=<current path>`; a session
 * that existed but expired adds `&reason=expired` (T036's friendly notice).
 * The header renders only after the guard passes.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const resolved = await resolveSession();
  if (resolved.status !== "valid") {
    const currentPath = (await headers()).get("x-pathname") ?? "/";
    const expired = resolved.status === "expired" ? "&reason=expired" : "";
    redirect(`/sign-in?next=${encodeURIComponent(currentPath)}${expired}`);
  }
  const session = resolved.session;

  return (
    <>
      <header className="border-border flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold">FocusTodo</span>
          <ProtectedNav />
        </div>
        {session && (
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-sm">
              Signed in as {session.user.name}
            </span>
            <SignOutButton />
          </div>
        )}
      </header>
      {children}
    </>
  );
}
