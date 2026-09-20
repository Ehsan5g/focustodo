import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskForm } from "@/features/tasks/TaskForm";
import type { TaskActionResult } from "@/server/actions/task-actions";
import type { CategoryDto } from "@/server/categories/service";
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
    categoryId: null,
    categoryName: null,
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

/**
 * F004 T017 (FR-005/FR-006/FR-007): the category surface in the form.
 */
const okCategorizedResult: TaskActionResult = {
  status: "success",
  task: {
    id: "task-2",
    title: "Categorized",
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    dueDate: null,
    createdAt: "2026-09-19T00:00:00.000Z",
    categoryId: "cat-1",
    categoryName: "Work",
  },
};

const categories: CategoryDto[] = [
  { id: "cat-1", name: "Work" },
  { id: "cat-2", name: "Errands" },
];

describe("TaskForm — category select (F004 T017)", () => {
  it("shows No category first and defaults to it", () => {
    render(<TaskForm action={mockAction()} categories={categories} />);
    const select = screen.getByLabelText("Category");
    const options = Array.from(select.querySelectorAll("option"));
    expect(options.map((option) => option.textContent)).toEqual([
      "No category",
      "Work",
      "Errands",
    ]);
    expect(select).toHaveValue("");
  });

  it("submits the selected categoryId through the shared schema", async () => {
    const action = mockAction(okCategorizedResult);
    const user = userEvent.setup();
    render(<TaskForm action={action} categories={categories} />);
    await user.type(screen.getByLabelText("Title"), "Categorized");
    await user.selectOptions(screen.getByLabelText("Category"), "cat-1");
    await user.click(screen.getByRole("button", { name: "Create task" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = vi.mocked(action).mock.calls[0][1] as FormData;
    const parsed = createTaskSchema.parse(Object.fromEntries(formData));
    expect(parsed.categoryId).toBe("cat-1");
  });

  it("submits the empty option as categoryId null (FR-006 clearing)", async () => {
    const action = mockAction();
    const user = userEvent.setup();
    render(
      <TaskForm
        action={action}
        categories={categories}
        initial={{ categoryId: "cat-2" }}
      />,
    );
    expect(screen.getByLabelText("Category")).toHaveValue("cat-2");
    await user.type(screen.getByLabelText("Title"), "Cleared cat");
    await user.selectOptions(screen.getByLabelText("Category"), "");
    await user.click(screen.getByRole("button", { name: "Create task" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = vi.mocked(action).mock.calls[0][1] as FormData;
    const parsed = createTaskSchema.parse(Object.fromEntries(formData));
    expect(parsed.categoryId).toBeNull();
  });

  it("prefills the initial categoryId for the edit surface (FR-008)", () => {
    render(
      <TaskForm
        action={mockAction()}
        categories={categories}
        initial={{ categoryId: "cat-2" }}
      />,
    );
    expect(screen.getByLabelText("Category")).toHaveValue("cat-2");
  });

  it("renders the empty state with a next action when no categories exist (FR-006)", () => {
    render(<TaskForm action={mockAction()} categories={[]} />);
    expect(screen.getByTestId("category-picker-empty")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create a category" }),
    ).toHaveAttribute("href", "/categories");
  });
});
