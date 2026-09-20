import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskItem } from "@/features/tasks/TaskItem";
import { TaskList } from "@/features/tasks/TaskList";
import type { TaskDto } from "@/server/tasks/service";
import { isOverdue } from "@/server/tasks/rules";

// TaskItem uses next/navigation's useRouter (US3 resync); jsdom tests mock it.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

/**
 * Component tests (F003 T016, FR-005/FR-012/FR-013, D12) for TaskItem and
 * the empty state: title, status badge, and priority badge rendered as TEXT
 * badges (never color alone); due date rendered when set; the OVERDUE flag
 * shown ONLY when the task is past its calendar day and not completed —
 * via the shared `isOverdue`; complete/reopen, edit, and delete controls
 * present; the empty state offers a clear create-first-task action.
 */

const TODAY = new Date("2026-09-19T12:00:00.000Z");

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TaskItem", () => {
  it("renders the title, a TEXT status badge, and a TEXT priority badge", () => {
    render(<TaskItem task={makeTask()} today={TODAY} />);
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    expect(screen.getByText("To do")).toBeInTheDocument();
    expect(screen.getByText(/Medium priority/i)).toBeInTheDocument();
    expect(isOverdue(null, "TODO", TODAY)).toBe(false);
  });

  it("renders the due date when set and no overdue flag for a future day", () => {
    render(
      <TaskItem task={makeTask({ dueDate: "2026-12-25" })} today={TODAY} />,
    );
    expect(screen.getByText(/Due 2026-12-25/)).toBeInTheDocument();
    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
  });

  it("shows the overdue flag ONLY for a past calendar day on an open task", () => {
    const { rerender } = render(
      <TaskItem
        task={makeTask({ dueDate: "2026-09-18", status: "TODO" })}
        today={TODAY}
      />,
    );
    expect(screen.getByText(/Overdue/)).toBeInTheDocument();

    // Completed tasks are never overdue (even past due).
    rerender(
      <TaskItem
        task={makeTask({ dueDate: "2026-09-18", status: "COMPLETED" })}
        today={TODAY}
      />,
    );
    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();

    // Due TODAY is not overdue (strictly past its calendar day).
    rerender(
      <TaskItem
        task={makeTask({ dueDate: "2026-09-19", status: "TODO" })}
        today={TODAY}
      />,
    );
    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
  });

  it("presents complete/reopen, edit, and delete controls; the toggle label reflects the target state", () => {
    const { rerender } = render(<TaskItem task={makeTask()} today={TODAY} />);
    expect(
      screen.getByRole("button", { name: /Complete/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Delete/ })).toBeInTheDocument();

    rerender(
      <TaskItem task={makeTask({ status: "COMPLETED" })} today={TODAY} />,
    );
    expect(screen.getByRole("button", { name: /Reopen/ })).toBeInTheDocument();
  });
});

describe("TaskList empty state", () => {
  it("offers a clear create-first-task action when there are no tasks", () => {
    render(<TaskList tasks={[]} today={TODAY} />);
    expect(
      screen.getByRole("button", { name: /create your first task/i }),
    ).toBeInTheDocument();
  });

  it("renders tasks newest-first without an empty state when tasks exist", () => {
    render(
      <TaskList
        today={TODAY}
        tasks={[
          makeTask({
            id: "b",
            title: "Newer",
            createdAt: "2026-09-19T10:00:00.000Z",
          }),
          makeTask({
            id: "a",
            title: "Older",
            createdAt: "2026-09-18T10:00:00.000Z",
          }),
        ]}
      />,
    );
    const older = screen.getByText("Older");
    const newer = screen.getByText("Newer");
    expect(
      newer.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /create your first task/i }),
    ).not.toBeInTheDocument();
  });
});
