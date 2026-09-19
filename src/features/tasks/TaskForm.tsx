"use client";

import { useActionState, useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { type TaskActionResult } from "@/server/actions/task-actions";

/**
 * TaskForm (feature 003-task-management, T014; contracts/
 * routes-and-surfaces.md) — the shared create/edit form (edit prefill lands
 * with US4 via the `initial` prop). Labeled fields; inline errors adjacent to
 * their field; the submit button is disabled while pending so rapid
 * double-submits create at most one task (D8). Validation is enforced by the
 * shared `createTaskSchema` on the server; the client shows the visible
 * defaults TODO / MEDIUM (FR-002) and uses the native
 * `<input type="date">` calendar-day control (D1).
 *
 * Fields are CONTROLLED: React auto-resets uncontrolled inputs after a
 * server-action submission, which would wipe typed input on a validation
 * error (same F002 SignInForm lesson).
 *
 * The action is injected as a prop so component tests (T011) can substitute
 * a mock; the page passes the real `createTaskAction` (T015).
 */

export type TaskFormAction = (
  state: TaskActionResult | null,
  formData: FormData,
) => Promise<TaskActionResult>;

export type TaskFormValues = {
  title?: string;
  description?: string;
  dueDate?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  status?: "TODO" | "IN_PROGRESS" | "COMPLETED";
};

const INITIAL_STATE = null;

export function TaskForm({
  action,
  initial,
  submitLabel = "Create task",
}: {
  action: TaskFormAction;
  initial?: TaskFormValues;
  submitLabel?: string;
}) {
  // D8 single-flight guard: the disabled button blocks user re-submission,
  // but a synchronous burst of submissions (e.g. scripted rapid clicks, D12
  // S11) can dispatch before React re-renders the button disabled. Re-entrant
  // calls while one submission is in flight return the SAME in-flight
  // promise — the server action runs exactly once.
  const inFlightRef = useRef<Promise<TaskActionResult> | null>(null);
  const formAction = useCallback(
    async (
      prev: TaskActionResult | null,
      formData: FormData,
    ): Promise<TaskActionResult> => {
      if (inFlightRef.current) return inFlightRef.current;
      const promise = action(prev, formData).finally(() => {
        inFlightRef.current = null;
      });
      inFlightRef.current = promise;
      return promise;
    },
    [action],
  );

  const [state, formActionBase, isPending] = useActionState(
    formAction,
    INITIAL_STATE,
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? "MEDIUM");
  const [status, setStatus] = useState(initial?.status ?? "TODO");

  const fieldErrors =
    state?.status === "validation_error" ? state.fieldErrors : [];
  const errorFor = (field: string) =>
    fieldErrors.find((fieldError) => fieldError.field === field)?.message;

  const inputClassName =
    "border-border bg-background focus-visible:outline-ring rounded-md border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <form action={formActionBase} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="task-title">Title</label>
        <input
          id="task-title"
          name="title"
          type="text"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={errorFor("title") ? true : false}
          aria-describedby={errorFor("title") ? "task-title-error" : undefined}
          className={inputClassName}
        />
        {errorFor("title") && (
          <p id="task-title-error" className="text-sm text-red-600">
            {errorFor("title")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="task-description">Description</label>
        <textarea
          id="task-description"
          name="description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-invalid={errorFor("description") ? true : false}
          aria-describedby={
            errorFor("description") ? "task-description-error" : undefined
          }
          className={inputClassName}
        />
        {errorFor("description") && (
          <p id="task-description-error" className="text-sm text-red-600">
            {errorFor("description")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="task-due-date">Due date</label>
        {/* Native date input — calendar day only, no time-of-day (D1). */}
        <input
          id="task-due-date"
          name="dueDate"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          aria-invalid={errorFor("dueDate") ? true : false}
          aria-describedby={
            errorFor("dueDate") ? "task-due-date-error" : undefined
          }
          className={inputClassName}
        />
        {errorFor("dueDate") && (
          <p id="task-due-date-error" className="text-sm text-red-600">
            {errorFor("dueDate")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="task-priority">Priority</label>
        <select
          id="task-priority"
          name="priority"
          value={priority}
          onChange={(event) =>
            setPriority(
              (event.target.value as TaskFormValues["priority"]) ?? "MEDIUM",
            )
          }
          className={inputClassName}
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="task-status">Status</label>
        <select
          id="task-status"
          name="status"
          value={status}
          onChange={(event) =>
            setStatus(
              (event.target.value as TaskFormValues["status"]) ?? "TODO",
            )
          }
          aria-invalid={errorFor("status") ? true : false}
          aria-describedby={
            errorFor("status") ? "task-status-error" : undefined
          }
          className={inputClassName}
        >
          <option value="TODO">To do</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
        {errorFor("status") && (
          <p id="task-status-error" className="text-sm text-red-600">
            {errorFor("status")}
          </p>
        )}
      </div>

      {state?.status === "failure" && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
