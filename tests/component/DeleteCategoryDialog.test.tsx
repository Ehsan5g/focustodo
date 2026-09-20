import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteCategoryDialog } from "@/features/categories/DeleteCategoryDialog";
import {
  deleteCategoryAction,
  type CategoryDeleteResult,
} from "@/server/actions/category-actions";

// The server action is the dialog's boundary — component tests replace it
// with a mock returning the contract's union (D12).
vi.mock("@/server/actions/category-actions", () => ({
  deleteCategoryAction: vi.fn(),
}));

/**
 * Component tests (F004 T028, US4; FR-010/FR-013/FR-014, D7/D8/D12) for
 * DeleteCategoryDialog: the copy states assigned tasks become uncategorized
 * and are NOT deleted (FR-010, US4.1); confirm invokes the deleteCategory
 * action; cancel closes with ZERO mutations (US4.3); fully keyboard-operable
 * with visible focus (Escape closes, focus lands on Cancel, D7); a failure
 * keeps the dialog open with a friendly message; rapid repeat clicks submit
 * once (D8).
 */

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DeleteCategoryDialog", () => {
  it("states that assigned tasks become uncategorized and are not deleted (FR-010, US4.1)", () => {
    render(
      <DeleteCategoryDialog
        categoryId="cat-1"
        categoryName="Work"
        open
        onDeleted={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/Work/)).toBeInTheDocument();
    expect(screen.getByText(/not deleted/i)).toBeInTheDocument();
    expect(screen.getByText(/become uncategorized/i)).toBeInTheDocument();
  });

  it("confirm invokes the deleteCategory action with the category id and closes on success", async () => {
    vi.mocked(deleteCategoryAction).mockResolvedValue({ status: "success" });
    const onDeleted = vi.fn();
    const user = userEvent.setup();

    render(
      <DeleteCategoryDialog
        categoryId="cat-1"
        categoryName="Work"
        open
        onDeleted={onDeleted}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete category" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleteCategoryAction).toHaveBeenCalledWith("cat-1");
  });

  it("cancel closes with ZERO mutations (US4.3)", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <DeleteCategoryDialog
        categoryId="cat-1"
        categoryName="Work"
        open
        onDeleted={vi.fn()}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByTestId("delete-category-cancel"));

    expect(onClose).toHaveBeenCalled();
    expect(deleteCategoryAction).not.toHaveBeenCalled();
  });

  it("Escape closes without any mutation (keyboard-operable, D7)", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <DeleteCategoryDialog
        categoryId="cat-1"
        categoryName="Work"
        open
        onDeleted={vi.fn()}
        onClose={onClose}
      />,
    );

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
    expect(deleteCategoryAction).not.toHaveBeenCalled();
  });

  it("moves focus to the cancel button when opened (visible focus, FR-014)", () => {
    render(
      <DeleteCategoryDialog
        categoryId="cat-1"
        categoryName="Work"
        open
        onDeleted={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId("delete-category-cancel")).toHaveFocus();
  });

  it("keeps the dialog open with a friendly message on failure", async () => {
    vi.mocked(deleteCategoryAction).mockResolvedValue({
      status: "failure",
      message:
        "This category no longer exists. Refresh to see your current list.",
    });
    const onDeleted = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <DeleteCategoryDialog
        categoryId="cat-1"
        categoryName="Work"
        open
        onDeleted={onDeleted}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete category" }));

    expect(await screen.findByText(/no longer exists/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("gates rapid repeat clicks to a single submission (D8)", async () => {
    let resolveAction!: (value: CategoryDeleteResult) => void;
    vi.mocked(deleteCategoryAction).mockImplementation(
      () =>
        new Promise<CategoryDeleteResult>((resolve) => {
          resolveAction = resolve;
        }),
    );
    const user = userEvent.setup();

    render(
      <DeleteCategoryDialog
        categoryId="cat-1"
        categoryName="Work"
        open
        onDeleted={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const confirm = screen.getByRole("button", { name: "Delete category" });
    await user.click(confirm);
    await user.click(confirm);
    await user.click(confirm);

    expect(deleteCategoryAction).toHaveBeenCalledTimes(1);
    resolveAction({ status: "success" });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Delete category" }),
      ).toBeEnabled(),
    );
  });
});
