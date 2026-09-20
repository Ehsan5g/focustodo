import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskEditSurface } from "@/features/tasks/TaskEditSurface";
import { updateTaskAction } from "@/server/actions/task-actions";
import type { TaskDto } from "@/server/tasks/service";
import { validateTransition } from "@/server/tasks/rules";

// The server action is the edit surface's boundary — component tests replace
// it with a mock returning the contract's TaskActionResult union (D12).
vi.mock("@/server/actions/task-actions", () => ({
  updateTaskAction: vi.fn(),
}));

/**
 * Component tests (F003 T026, US4; FR-006/FR-007, D2/D12) for the edit
 * surface: prefilled from the TaskDto; clearing description/dueDate submits
 * the cleared values (the shared schema normalizes them to null, FR-007);
 * cancel closes with ZERO mutations; a backward status pick shows the inline
 * `status` error BEFORE any submit — the shared `validateTransition` runs
 * client-side (clarified lifecycle, D2).
 */

function makeTask(overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id: "task-1",
    title: "Buy milk",
    description: "Two liters",
    status: "IN_PROGRESS",
    priority: "HIGH",
    dueDate: "2026-12-25",
    createdAt: "2026-09-19T00:00:00.000Z",
    categoryId: null,
    categoryName: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TaskEditSurface", () => {
  it("prefills every field from the TaskDto", () => {
    render(<TaskEditSurface task={makeTask()} open onClose={vi.fn()} />);

    expect(screen.getByLabelText("Title")).toHaveValue("Buy milk");
    expect(screen.getByLabelText("Description")).toHaveValue("Two liters");
    expect(screen.getByLabelText("Due date")).toHaveValue("2026-12-25");
    expect(screen.getByLabelText("Priority")).toHaveValue("HIGH");
    expect(screen.getByLabelText("Status")).toHaveValue("IN_PROGRESS");
  });

  it("submits edited values through the injected action and closes on success", async () => {
    const updated = makeTask({ title: "Buy oat milk", priority: "LOW" });
    vi.mocked(updateTaskAction).mockResolvedValue({
      status: "success",
      task: updated,
    });
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<TaskEditSurface task={makeTask()} open onClose={onClose} />);

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Buy oat milk");
    await user.selectOptions(screen.getByLabelText("Priority"), "LOW");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateTaskAction).toHaveBeenCalledTimes(1);
    const formData = vi.mocked(updateTaskAction).mock.calls[0][1] as FormData;
    expect(formData.get("taskId")).toBe("task-1");
    expect(formData.get("title")).toBe("Buy oat milk");
    expect(formData.get("priority")).toBe("LOW");
  });

  it("clearing description/dueDate submits the empty values so the shared schema stores null (FR-007)", async () => {
    vi.mocked(updateTaskAction).mockResolvedValue({
      status: "success",
      task: makeTask({ description: null, dueDate: null }),
    });
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<TaskEditSurface task={makeTask()} open onClose={onClose} />);

    await user.clear(screen.getByLabelText("Description"));
    await user.clear(screen.getByLabelText("Due date"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const formData = vi.mocked(updateTaskAction).mock.calls[0][1] as FormData;
    expect(formData.get("description")).toBe("");
    expect(formData.get("dueDate")).toBe("");
  });

  it("cancel closes with ZERO mutations (US4 S4)", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<TaskEditSurface task={makeTask()} open onClose={onClose} />);

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Changed but cancelled");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(updateTaskAction).not.toHaveBeenCalled();
  });

  it("a backward status pick shows the inline status error BEFORE submit — no action call (D2)", async () => {
    const user = userEvent.setup();

    render(
      <TaskEditSurface
        task={makeTask({ status: "IN_PROGRESS" })}
        open
        onClose={vi.fn()}
      />,
    );

    // Shared rule sanity: the picked pair really is a violation.
    expect(validateTransition("IN_PROGRESS", "TODO")).toBe(false);

    await user.selectOptions(screen.getByLabelText("Status"), "TODO");

    const error = await screen.findByText(/Status can only move forward/i);
    expect(error).toBeInTheDocument();

    // The server action is NEVER called with an illegal pair.
    expect(updateTaskAction).not.toHaveBeenCalled();

    // Correcting the pick clears the inline error.
    await user.selectOptions(screen.getByLabelText("Status"), "COMPLETED");
    await waitFor(() =>
      expect(screen.queryByText(/Status can only move forward/i)).toBeNull(),
    );
  });

  it("surfaces a validation error from the server near its field without closing", async () => {
    vi.mocked(updateTaskAction).mockResolvedValue({
      status: "validation_error",
      fieldErrors: [{ field: "title", message: "Title is required" }],
    });
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<TaskEditSurface task={makeTask()} open onClose={onClose} />);

    await user.clear(screen.getByLabelText("Title"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
