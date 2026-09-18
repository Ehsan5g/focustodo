import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { RegisterForm } from "@/features/auth/RegisterForm";
import { registerAction } from "@/server/actions/auth-actions";

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
 * Component tests (F002 T016) for the RegisterForm (D10, D12): labeled
 * name/email/password fields; pending state on submit; `validation_error` →
 * inline error next to the offending field; duplicate-email error shown on
 * the email field; non-password input preserved while the password field is
 * cleared on failure (FR-013, FR-014).
 */

beforeEach(() => {
  vi.resetAllMocks();
});

async function typeIntoAllFields(
  user: ReturnType<typeof userEvent.setup>,
  values: { name: string; email: string; password: string },
) {
  await user.type(screen.getByLabelText("Name"), values.name);
  await user.type(screen.getByLabelText("Email"), values.email);
  await user.type(screen.getByLabelText("Password"), values.password);
}

it("renders labeled name, email, and password fields plus a link to sign in", () => {
  render(<RegisterForm />);
  expect(screen.getByLabelText("Name")).toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toBeInTheDocument();
  expect(screen.getByLabelText("Password")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Already have an account? Sign in" }),
  ).toHaveAttribute("href", "/sign-in");
});

it("shows a pending state on submit and re-enables the button afterwards", async () => {
  let resolveAction!: (
    value: Awaited<ReturnType<typeof registerAction>>,
  ) => void;
  vi.mocked(registerAction).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
  );
  const user = userEvent.setup();
  render(<RegisterForm />);
  await user.type(screen.getByLabelText("Name"), "Ada Lovelace");
  await user.type(screen.getByLabelText("Email"), "pending@test.local");
  await user.type(screen.getByLabelText("Password"), "supersafe99");

  const submit = screen.getByRole("button", { name: "Create account" });
  await user.click(submit);
  expect(submit).toBeDisabled();

  resolveAction({
    status: "failure",
    message: "Something went wrong. Please try again.",
  });
  await waitFor(() => expect(submit).toBeEnabled());
});

it("renders a validation_error inline next to the offending field", async () => {
  vi.mocked(registerAction).mockResolvedValue({
    status: "validation_error",
    fieldErrors: [
      { field: "password", message: "Password must be at least 8 characters" },
    ],
  });
  const user = userEvent.setup();
  render(<RegisterForm />);
  await typeIntoAllFields(user, {
    name: "Ada Lovelace",
    email: "inline@test.local",
    password: "short",
  });
  await user.click(screen.getByRole("button", { name: "Create account" }));

  await screen.findByText("Password must be at least 8 characters");
  expect(screen.getByLabelText("Password")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByLabelText("Name")).toHaveAttribute(
    "aria-invalid",
    "false",
  );
});

it("shows the duplicate-email error on the email field", async () => {
  vi.mocked(registerAction).mockResolvedValue({
    status: "validation_error",
    fieldErrors: [
      {
        field: "email",
        message: "This email is already registered. Try signing in instead.",
      },
    ],
  });
  const user = userEvent.setup();
  render(<RegisterForm />);
  await typeIntoAllFields(user, {
    name: "John Doe",
    email: "john@test.local",
    password: "supersafe99",
  });
  await user.click(screen.getByRole("button", { name: "Create account" }));

  await screen.findByText(
    "This email is already registered. Try signing in instead.",
  );
  expect(screen.getByLabelText("Email")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

it("preserves name and email but clears the password on failure", async () => {
  vi.mocked(registerAction).mockResolvedValue({
    status: "failure",
    message: "Something went wrong. Please try again.",
  });
  const user = userEvent.setup();
  render(<RegisterForm />);
  await typeIntoAllFields(user, {
    name: "Ada Lovelace",
    email: "preserve@test.local",
    password: "supersafe99",
  });
  await user.click(screen.getByRole("button", { name: "Create account" }));

  await screen.findByText("Something went wrong. Please try again.");
  expect(screen.getByLabelText("Name")).toHaveValue("Ada Lovelace");
  expect(screen.getByLabelText("Email")).toHaveValue("preserve@test.local");
  expect(screen.getByLabelText("Password")).toHaveValue("");
});

it("submits the form values and navigates to redirectTo on success", async () => {
  vi.mocked(registerAction).mockResolvedValue({
    status: "success",
    redirectTo: "/",
  });
  const user = userEvent.setup();
  render(<RegisterForm />);
  await typeIntoAllFields(user, {
    name: "Ada Lovelace",
    email: "success@test.local",
    password: "supersafe99",
  });
  await user.click(screen.getByRole("button", { name: "Create account" }));

  await waitFor(() => expect(routerMocks.push).toHaveBeenCalledWith("/"));
  expect(registerAction).toHaveBeenCalledTimes(1);
  const formData = vi.mocked(registerAction).mock.calls[0][1] as FormData;
  expect(formData.get("name")).toBe("Ada Lovelace");
  expect(formData.get("email")).toBe("success@test.local");
  expect(formData.get("password")).toBe("supersafe99");
});
