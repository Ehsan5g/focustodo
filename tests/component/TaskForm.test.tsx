import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { TaskForm } from "@/features/tasks/TaskForm";
import type { TaskActionResult } from "@/server/actions/task-actions";
import { createTaskSchema } from "@/validation/task-schema";

/**
 * Component tests (F003 T011, FR-001–FR-003, D12) for TaskForm: labeled
 * fields for title/description/due-date/priority/status; title-only submit
 * carries the visible defaults (TODO/MEDIUM) through the shared
 * `createTaskSchema`; invalid submissions render inline field errors and
 * preserve typed input; clearing optional fields submits values that the
 * shared schema normalizes to `null`; pending state gates re-submission.
 *
 * The action is injected as a prop — the real server action (Prisma +
 * requireSession) is never loaded in jsdom.
 */

const okResult: TaskActionResult = {
  status: "success",
  task: {
    id: "task-1",
    title: "Buy milk",
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    dueDate: null,
    createdAt: "2026-09-19T00:00:00.000Z",
  },
};

function mockAction(
  result: TaskActionResult = okResult,
): (
  state: TaskActionResult | null,
  formData: FormData,
) => Promise<TaskActionResult> {
  return vi.fn(async () => result);
}

beforeEach(() => {
  vi.clearAllMocks();
});

it("renders labeled title, description, due date, priority, and status fields", () => {
  render(<TaskForm action={mockAction()} />);
  expect(screen.getByLabelText("Title")).toBeInTheDocument();
  expect(screen.getByLabelText("Description")).toBeInTheDocument();
  expect(screen.getByLabelText("Due date")).toBeInTheDocument();
  expect(screen.getByLabelText("Priority")).toBeInTheDocument();
  expect(screen.getByLabelText("Status")).toBeInTheDocument();
  const dueDate = screen.getByLabelText("Due date");
  expect(dueDate).toHaveAttribute("type", "date");
});

it("submits title-only with the visible defaults TODO / MEDIUM through the shared schema", async () => {
  const action = mockAction();
  const user = userEvent.setup();
  render(<TaskForm action={action} />);
  expect(screen.getByLabelText("Priority")).toHaveValue("MEDIUM");
  expect(screen.getByLabelText("Status")).toHaveValue("TODO");

  await user.type(screen.getByLabelText("Title"), "Buy milk");
  await user.click(screen.getByRole("button", { name: "Create task" }));

  await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  const formData = vi.mocked(action).mock.calls[0][1] as FormData;
  const parsed = createTaskSchema.parse(Object.fromEntries(formData));
  expect(parsed.title).toBe("Buy milk");
  expect(parsed.status).toBe("TODO");
  expect(parsed.priority).toBe("MEDIUM");
  expect(parsed.description).toBeNull();
  expect(parsed.dueDate).toBeNull();
});

it("renders inline field errors and preserves typed input on validation_error", async () => {
  const action = mockAction({
    status: "validation_error",
    fieldErrors: [
      { field: "title", message: "Title must be at most 120 characters" },
      {
        field: "dueDate",
        message: "Due date must be a valid date (YYYY-MM-DD)",
      },
    ],
  });
  const user = userEvent.setup();
  render(<TaskForm action={action} />);
  await user.type(screen.getByLabelText("Title"), "x".repeat(121));
  await user.type(screen.getByLabelText("Due date"), "2026-13-99");
  await user.click(screen.getByRole("button", { name: "Create task" }));

  await screen.findByText("Title must be at most 120 characters");
  await screen.findByText("Due date must be a valid date (YYYY-MM-DD)");
  expect(screen.getByLabelText("Title")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  // Typed input preserved after the failed submission.
  expect(screen.getByLabelText("Title")).toHaveValue("x".repeat(121));
  expect(action).toHaveBeenCalledTimes(1);
});

it("normalizes cleared optional fields to null via the shared schema", async () => {
  const action = mockAction();
  const user = userEvent.setup();
  render(<TaskForm action={action} />);
  await user.type(screen.getByLabelText("Title"), "Cleared extras");
  // Type into optionals, then clear them — the submitted payload must
  // normalize to null (FR-007).
  await user.type(screen.getByLabelText("Description"), "temp");
  await user.clear(screen.getByLabelText("Description"));
  await user.click(screen.getByRole("button", { name: "Create task" }));

  await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  const formData = vi.mocked(action).mock.calls[0][1] as FormData;
  const parsed = createTaskSchema.parse(Object.fromEntries(formData));
  expect(parsed.description).toBeNull();
  expect(parsed.dueDate).toBeNull();
});

it("gates re-submission while pending (double-submit prevention, D8)", async () => {
  let resolveAction!: (value: TaskActionResult) => void;
  const action = vi.fn(
    () =>
      new Promise<TaskActionResult>((resolve) => {
        resolveAction = resolve;
      }),
  );
  const user = userEvent.setup();
  render(<TaskForm action={action} />);
  await user.type(screen.getByLabelText("Title"), "Once only");
  const submit = screen.getByRole("button", { name: "Create task" });
  await user.click(submit);
  expect(submit).toBeDisabled();
  await userEvent.setup({ pointerEventsCheck: 0 }).click(submit);
  expect(action).toHaveBeenCalledTimes(1);
  resolveAction(okResult);
  await waitFor(() => expect(submit).toBeEnabled());
});
