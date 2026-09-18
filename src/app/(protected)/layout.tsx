import type { ReactNode } from "react";

import { SignOutButton } from "@/features/auth/SignOutButton";
import { requireSession } from "@/server/auth/session";

/**
 * Protected layout (F002 T028): the authenticated header shows the
 * signed-in user's name (server-derived via `requireSession()`, FR-012) and
 * the sign-out control. The AUTHORITATIVE redirect guard (missing/expired
 * session → `/sign-in`) arrives with US3/T032.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();

  return (
    <>
      <header className="border-border flex items-center justify-between border-b px-6 py-3">
        <span className="font-semibold">FocusTodo</span>
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
