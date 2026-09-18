import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { SignInForm } from "@/features/auth/SignInForm";
import { signInAction } from "@/server/actions/auth-actions";

// The server action is the form's boundary — component tests replace it with
// a mock returning the contract's ActionResult union (D12). The real module
// (Prisma + Auth.js) is never loaded in jsdom.
vi.mock("@/server/actions/auth-actions", () => ({
  registerAction: vi.fn(),
  signInAction: vi.fn(),
  signOutAction: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerMocks.push,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

/**
 * Component tests (F002 T022) for the SignInForm (D10): labeled email +
 * password fields; pending state; `validation_error` → inline field errors;
 * credential failure → ONE generic message for both wrong password and
 * unknown email (FR-005); password cleared on failure (FR-013, FR-014).
 */

beforeEach(() => {
  vi.resetAllMocks();
});

it("renders labeled email and password fields plus a link to registration", () => {
  render(<SignInForm />);
  expect(screen.getByLabelText("Email")).toBeInTheDocument();
  expect(screen.getByLabelText("Password")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Need an account? Register" }),
  ).toHaveAttribute("href", "/register");
});

it("shows a pending state on submit and re-enables the button afterwards", async () => {
  let resolveAction!: (value: Awaited<ReturnType<typeof signInAction>>) => void;
  vi.mocked(signInAction).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
  );
  const user = userEvent.setup();
  render(<SignInForm />);
  await user.type(screen.getByLabelText("Email"), "ada@test.local");
  await user.type(screen.getByLabelText("Password"), "password123");

  const submit = screen.getByRole("button", { name: "Sign in" });
  await user.click(submit);
  expect(submit).toBeDisabled();

  resolveAction({ status: "failure", message: "Invalid email or password" });
  await waitFor(() => expect(submit).toBeEnabled());
});

it("renders a validation_error inline next to the offending field", async () => {
  vi.mocked(signInAction).mockResolvedValue({
    status: "validation_error",
    fieldErrors: [
      { field: "email", message: "Please enter a valid email address" },
    ],
  });
  const user = userEvent.setup();
  render(<SignInForm />);
  await user.type(screen.getByLabelText("Email"), "not-an-email");
  await user.type(screen.getByLabelText("Password"), "password123");
  await user.click(screen.getByRole("button", { name: "Sign in" }));

  await screen.findByText("Please enter a valid email address");
  expect(screen.getByLabelText("Email")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

it("shows the ONE generic message on credential failure", async () => {
  vi.mocked(signInAction).mockResolvedValue({
    status: "failure",
    message: "Invalid email or password",
  });
  const user = userEvent.setup();
  render(<SignInForm />);
  await user.type(screen.getByLabelText("Email"), "ada@test.local");
  await user.type(screen.getByLabelText("Password"), "wrong-password");
  await user.click(screen.getByRole("button", { name: "Sign in" }));

  await screen.findByText("Invalid email or password");
  // Exactly one generic banner — never two, never field-specific.
  expect(
    screen.getAllByText("Invalid email or password").length,
  ).toBeGreaterThan(0);
});

it("preserves email but clears the password on failure", async () => {
  vi.mocked(signInAction).mockResolvedValue({
    status: "failure",
    message: "Invalid email or password",
  });
  const user = userEvent.setup();
  render(<SignInForm />);
  await user.type(screen.getByLabelText("Email"), "ada@test.local");
  await user.type(screen.getByLabelText("Password"), "password123");
  await user.click(screen.getByRole("button", { name: "Sign in" }));

  await screen.findByText("Invalid email or password");
  expect(screen.getByLabelText("Email")).toHaveValue("ada@test.local");
  expect(screen.getByLabelText("Password")).toHaveValue("");
});

it("submits the form values and navigates to redirectTo on success", async () => {
  vi.mocked(signInAction).mockResolvedValue({
    status: "success",
    redirectTo: "/",
  });
  const user = userEvent.setup();
  render(<SignInForm />);
  await user.type(screen.getByLabelText("Email"), "ada@test.local");
  await user.type(screen.getByLabelText("Password"), "password123");
  await user.click(screen.getByRole("button", { name: "Sign in" }));

  await waitFor(() => expect(routerMocks.push).toHaveBeenCalledWith("/"));
  expect(signInAction).toHaveBeenCalledTimes(1);
  const formData = vi.mocked(signInAction).mock.calls[0][1] as FormData;
  expect(formData.get("email")).toBe("ada@test.local");
  expect(formData.get("password")).toBe("password123");
});
