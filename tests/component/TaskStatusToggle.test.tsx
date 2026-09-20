import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskStatusToggle } from "@/features/tasks/TaskStatusToggle";
import {
  setTaskStatusAction,
  type TaskActionResult,
} from "@/server/actions/task-actions";
import type { TaskDto } from "@/server/tasks/service";

// The server action is the toggle's boundary — component tests replace it
// with a mock returning the contract's TaskActionResult union (D12).
vi.mock("@/server/actions/task-actions", () => ({
  setTaskStatusAction: vi.fn(),
}));

/**
 * Component tests (F003 T021, FR-008/FR-009, D3/D12) for TaskStatusToggle:
 * the label reflects the TARGET state (complete vs reopen); the optimistic
 * flip happens immediately without waiting for the action; a rejected
 * transition surfaces a friendly error and rolls back; a failure rolls the
 * UI back and resyncs from the server state.
 */

function makeTask(overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id: "task-1",
    title: "Buy milk",
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    dueDate: null,
    createdAt: "2026-09-19T00:00:00.000Z",
    ...overrides,
  };
}

const okUpdate = (status: TaskDto["status"]): TaskActionResult => ({
  status: "success",
  task: makeTask({ status }),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TaskStatusToggle", () => {
  it("labels the control by the target state: Complete for TODO, Reopen for COMPLETED", () => {
    const { rerender } = render(
      <TaskStatusToggle task={makeTask()} onUpdated={vi.fn()} />,
    );
    expect(
      screen.getByRole("button", { name: /Complete/ }),
    ).toBeInTheDocument();

    rerender(
      <TaskStatusToggle
        task={makeTask({ status: "COMPLETED" })}

        onUpdated={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Reopen/ })).toBeInTheDocument();
  });

  it("flips the label optimistically while the write is in flight", async () => {
    let resolveAction!: (value: TaskActionResult) => void;
    vi.mocked(setTaskStatusAction).mockImplementation(
      () =>
        new Promise<TaskActionResult>((resolve) => {
          resolveAction = resolve;
        }),
    );
    const onUpdated = vi.fn();
    const user = userEvent.setup();
    render(
      <TaskStatusToggle
        task={makeTask({ status: "TODO" })}

        onUpdated={onUpdated}
      />,
    );

    const button = screen.getByRole("button", { name: /Complete/ });
    await user.click(button);

    // The optimistic target state is visible BEFORE the action resolves.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Reopen/ }),
      ).toBeInTheDocument(),
    );

    resolveAction(okUpdate("COMPLETED"));
    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
  });

  it("rolls back and shows a friendly error when the action fails", async () => {
    vi.mocked(setTaskStatusAction).mockResolvedValue({
      status: "failure",
      message: "This task no longer exists. Refresh to see your current list.",
    });
    const onUpdated = vi.fn();
    const user = userEvent.setup();
    render(
      <TaskStatusToggle
        task={makeTask({ status: "TODO" })}

        onUpdated={onUpdated}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Complete/ }));

    // The label returns to the server state and ONE friendly error shows.
    await screen.findByText(
      "This task no longer exists. Refresh to see your current list.",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Complete/ }),
      ).toBeInTheDocument(),
    );
    // Resync from the server on failure (D3): onUpdated fires so the parent
    // refreshes — the write may even have landed (e.g. a dropped response).
    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
  });

  it("gates re-fires while pending (rapid toggling settles consistent, D8)", async () => {
    let resolveAction!: (value: TaskActionResult) => void;
    vi.mocked(setTaskStatusAction).mockImplementation(
      () =>
        new Promise<TaskActionResult>((resolve) => {
          resolveAction = resolve;
        }),
    );
    const user = userEvent.setup();
    // Stateful parent harness: onUpdated delivers the server DTO, like the
    // real list does via refreshed server data.
    function Harness() {
      const [task, setTask] = useState<TaskDto>(makeTask({ status: "TODO" }));
      return <TaskStatusToggle task={task} onUpdated={setTask} />;
    }
    render(<Harness />);

    const button = screen.getByRole("button", { name: /Complete/ });
    await user.click(button);
    // The optimistic flip shows Reopen; a rapid second click is a no-op.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Reopen/ }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Reopen/ }));

    expect(setTaskStatusAction).toHaveBeenCalledTimes(1);
    resolveAction(okUpdate("COMPLETED"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Reopen/ })).toBeEnabled(),
    );
  });
});
