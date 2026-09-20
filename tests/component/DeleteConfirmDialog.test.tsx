import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteConfirmDialog } from "@/features/tasks/DeleteConfirmDialog";
import {
  deleteTaskAction,
  type DeleteTaskResult,
} from "@/server/actions/task-actions";

// The server action is the dialog's boundary — component tests replace it
// with a mock returning the contract's union (D12).
vi.mock("@/server/actions/task-actions", () => ({
  deleteTaskAction: vi.fn(),
}));

/**
 * Component tests (F003 T031, US5; FR-010/FR-014, D7/D12) for
 * DeleteConfirmDialog: confirm invokes the deleteTask action; cancel closes
 * with ZERO mutations; the dialog is fully keyboard-operable with visible
 * focus (Escape closes like the adaptive surfaces, D7); a failure keeps the
 * dialog open with a friendly message; rapid repeat clicks submit once (D8).
 */

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DeleteConfirmDialog", () => {
  it("confirm invokes the deleteTask action with the task id and closes on success", async () => {
    vi.mocked(deleteTaskAction).mockResolvedValue({ status: "success" });
    const onDeleted = vi.fn();
    const user = userEvent.setup();

    render(
      <DeleteConfirmDialog
        taskId="task-1"
        taskTitle="Buy milk"
        open
        onDeleted={onDeleted}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/Buy milk/)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleteTaskAction).toHaveBeenCalledWith("task-1");
  });

  it("cancel closes with ZERO mutations (FR-010)", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <DeleteConfirmDialog
        taskId="task-1"
        taskTitle="Buy milk"
        open
        onDeleted={vi.fn()}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(deleteTaskAction).not.toHaveBeenCalled();
  });

  it("Escape closes without any mutation (keyboard-operable, D7)", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <DeleteConfirmDialog
        taskId="task-1"
        taskTitle="Buy milk"
        open
        onDeleted={vi.fn()}
        onClose={onClose}
      />,
    );

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
    expect(deleteTaskAction).not.toHaveBeenCalled();
  });

  it("keeps the dialog open with a friendly message on failure", async () => {
    vi.mocked(deleteTaskAction).mockResolvedValue({
      status: "failure",
      message: "This task no longer exists. Refresh to see your current list.",
    });
    const onDeleted = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <DeleteConfirmDialog
        taskId="task-1"
        taskTitle="Buy milk"
        open
        onDeleted={onDeleted}
        onClose={onClose}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );

    expect(await screen.findByText(/no longer exists/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("gates rapid repeat clicks to a single submission (D8)", async () => {
    let resolveAction!: (value: DeleteTaskResult) => void;
    vi.mocked(deleteTaskAction).mockImplementation(
      () =>
        new Promise<DeleteTaskResult>((resolve) => {
          resolveAction = resolve;
        }),
    );
    const user = userEvent.setup();

    render(
      <DeleteConfirmDialog
        taskId="task-1"
        taskTitle="Buy milk"
        open
        onDeleted={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const confirm = screen.getByRole("button", { name: "Delete permanently" });
    await user.click(confirm);
    await user.click(confirm);
    await user.click(confirm);

    expect(deleteTaskAction).toHaveBeenCalledTimes(1);
    resolveAction({ status: "success" });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Delete permanently" }),
      ).toBeEnabled(),
    );
  });
});
