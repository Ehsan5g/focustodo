import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CategoryForm } from "@/features/categories/CategoryForm";
import type { CategoryActionResult } from "@/server/actions/category-actions";
import { createCategorySchema } from "@/validation/category-schema";

/**
 * Component tests (F004 T009, FR-001/FR-002/FR-013, D7) for CategoryForm:
 * a labeled name field with visible focus; a spaces-only submit shows the
 * inline "name is required" error near the field with ZERO action calls
 * (S3); a duplicate (server validation_error) renders the message near the
 * name field (S2); a 60-character name submits through the shared schema
 * (S4); loading and error states are visible; the submit button is disabled
 * while pending so rapid re-submits create at most one category (D8).
 *
 * The action is injected as a prop — the real server action (Prisma +
 * requireSession) is never loaded in jsdom.
 */

const okResult: CategoryActionResult = {
  status: "success",
  category: { id: "cat-1", name: "Work" },
};

function mockAction(
  result: CategoryActionResult = okResult,
): (
  state: CategoryActionResult | null,
  formData: FormData,
) => Promise<CategoryActionResult> {
  return vi.fn(async () => result);
}

beforeEach(() => {
  vi.clearAllMocks();
});

it("renders a labeled name field that takes visible keyboard focus", async () => {
  const user = userEvent.setup();
  render(<CategoryForm action={mockAction()} />);
  const name = screen.getByLabelText("Category name");
  expect(name).toBeInTheDocument();
  await user.click(name);
  expect(name).toHaveFocus();
  expect(screen.getByRole("button", { name: "Create category" })).toBeEnabled();
});

it("a spaces-only submit shows the inline required error with zero action calls (S3)", async () => {
  const action = mockAction();
  const user = userEvent.setup();
  render(<CategoryForm action={action} />);
  await user.type(screen.getByLabelText("Category name"), "   ");
  await user.click(screen.getByRole("button", { name: "Create category" }));
  expect(screen.getByText("Category name is required")).toBeInTheDocument();
  expect(screen.getByLabelText("Category name")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(action).not.toHaveBeenCalled();
});

it("renders the server duplicate error near the name field and preserves input (S2)", async () => {
  const action = mockAction({
    status: "validation_error",
    fieldErrors: [
      { field: "name", message: "You already have a category with this name." },
    ],
  });
  const user = userEvent.setup();
  render(<CategoryForm action={action} />);
  await user.type(screen.getByLabelText("Category name"), "work");
  await user.click(screen.getByRole("button", { name: "Create category" }));

  await screen.findByText("You already have a category with this name.");
  expect(screen.getByLabelText("Category name")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  // Typed input preserved after the failed submission.
  expect(screen.getByLabelText("Category name")).toHaveValue("work");
  expect(action).toHaveBeenCalledTimes(1);
});

it("submits a 60-character name through the shared schema (S4)", async () => {
  const action = mockAction();
  const user = userEvent.setup();
  render(<CategoryForm action={action} />);
  await user.type(screen.getByLabelText("Category name"), "x".repeat(60));
  await user.click(screen.getByRole("button", { name: "Create category" }));

  await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  const formData = vi.mocked(action).mock.calls[0][1] as FormData;
  const parsed = createCategorySchema.parse(Object.fromEntries(formData));
  expect(parsed.name).toBe("x".repeat(60));
});

it("gates re-submission while pending (double-submit prevention, D8)", async () => {
  let resolveAction!: (value: CategoryActionResult) => void;
  const action = vi.fn(
    () =>
      new Promise<CategoryActionResult>((resolve) => {
        resolveAction = resolve;
      }),
  );
  const user = userEvent.setup();
  render(<CategoryForm action={action} />);
  await user.type(screen.getByLabelText("Category name"), "Once only");
  const submit = screen.getByRole("button", { name: "Create category" });
  await user.click(submit);
  expect(submit).toBeDisabled();
  expect(screen.getByText("Saving…")).toBeInTheDocument();
  await userEvent.setup({ pointerEventsCheck: 0 }).click(submit);
  expect(action).toHaveBeenCalledTimes(1);
  resolveAction(okResult);
  await waitFor(() => expect(submit).toBeEnabled());
});

it("renders the generic failure message (constitution V — friendly, never technical)", async () => {
  const action = mockAction({
    status: "failure",
    message: "Something went wrong. Please try again.",
  });
  const user = userEvent.setup();
  render(<CategoryForm action={action} />);
  await user.type(screen.getByLabelText("Category name"), "Work");
  await user.click(screen.getByRole("button", { name: "Create category" }));
  await screen.findByText("Something went wrong. Please try again.");
});

// ——— F004 US3 (T024): the rename surface — pre-filled adaptive edit form ———
//
// The surface reuses CategoryForm with the current name prefilled, a hidden
// categoryId, and edit-mode labels. Server errors (duplicate S9, length S9)
// render near the field; Cancel closes with ZERO mutations; the field takes
// visible keyboard focus (FR-013).
describe("CategoryForm rename mode (F004 US3, T024)", () => {
  it("opens pre-filled with the current name and submits the hidden categoryId with the new name (S8)", async () => {
    const action = mockAction(okResult);
    const user = userEvent.setup();

    render(
      <CategoryForm
        action={action}
        initial={{ name: "Work" }}
        categoryId="cat-1"
        submitLabel="Save changes"
        cancelLabel="Cancel"
        onCancel={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Category name");
    expect(input).toHaveValue("Work");

    await user.clear(input);
    await user.type(input, "Deep Work");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = vi.mocked(action).mock.calls[0]![1] as FormData;
    expect(formData.get("categoryId")).toBe("cat-1");
    expect(formData.get("name")).toBe("Deep Work");
  });

  it("renders the duplicate error near the field and keeps the typed rename (S9)", async () => {
    const action = mockAction({
      status: "validation_error",
      fieldErrors: [
        {
          field: "name",
          message: "You already have a category with this name.",
        },
      ],
    });
    const user = userEvent.setup();

    render(
      <CategoryForm
        action={action}
        initial={{ name: "Work" }}
        categoryId="cat-1"
        submitLabel="Save changes"
      />,
    );

    const input = screen.getByLabelText("Category name");
    await user.clear(input);
    await user.type(input, "deep work");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(
        screen.getByText("You already have a category with this name."),
      ).toBeInTheDocument(),
    );
    expect(input).toHaveValue("deep work");
    expect(input).toBeInvalid();
  });

  it("renders the length error near the field for a 61-character rename (S9)", async () => {
    const action = mockAction({
      status: "validation_error",
      fieldErrors: [
        {
          field: "name",
          message: "Category name must be at most 60 characters",
        },
      ],
    });
    const user = userEvent.setup();

    render(
      <CategoryForm
        action={action}
        initial={{ name: "Short" }}
        categoryId="cat-1"
        submitLabel="Save changes"
      />,
    );

    const input = screen.getByLabelText("Category name");
    await user.clear(input);
    await user.type(input, "x".repeat(61));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(
        screen.getByText("Category name must be at most 60 characters"),
      ).toBeInTheDocument(),
    );
    expect(input).toBeInvalid();
  });

  it("cancel closes with zero mutations and the field takes visible focus (keyboard-operable, FR-013)", async () => {
    const action = mockAction(okResult);
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <CategoryForm
        action={action}
        initial={{ name: "Work" }}
        categoryId="cat-1"
        submitLabel="Save changes"
        cancelLabel="Cancel"
        onCancel={onCancel}
      />,
    );

    // First tab stop is the name field — focus must be visible (FR-013).
    await user.tab();
    expect(screen.getByLabelText("Category name")).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
  });
});
