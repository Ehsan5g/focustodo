import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { requireSession } from "@/server/auth/session";

/**
 * `(auth)` layout (F002 T033) — the reverse guard (FR-009): a user with a
 * valid session never sees the auth views; they are bounced to the
 * protected area. No `returnTo` handling here, per
 * contracts/routes-and-guards.md.
 */
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (await requireSession()) {
    redirect("/");
  }
  return <>{children}</>;
}
