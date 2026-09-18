import { SignInForm } from "@/features/auth/SignInForm";

/**
 * Sign-in page (F002 T026) — a public Server Component rendering the
 * SignInForm. A `?next=` destination (US3's middleware) seeds the form's
 * hidden `returnTo` so the action can honor it AS-IS (clarified FR-008).
 * The signed-in bounce (FR-009) arrives with US3's `(auth)` layout.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;
  return (
    <main
      id="main-content"
      className="flex flex-1 items-center justify-center p-6"
    >
      <SignInForm returnTo={next} expiredNotice={reason === "expired"} />
    </main>
  );
}
