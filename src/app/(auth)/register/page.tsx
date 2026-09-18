import { RegisterForm } from "@/features/auth/RegisterForm";

/**
 * Registration page (F002 T020) — a public Server Component rendering the
 * RegisterForm. The `(auth)` route group has no layout yet; it arrives with
 * US3's signed-in bounce (FR-009).
 */
export default function RegisterPage() {
  return (
    <main
      id="main-content"
      className="flex flex-1 items-center justify-center p-6"
    >
      <RegisterForm />
    </main>
  );
}
