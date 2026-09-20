"use client";

import { useActionState, useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CategoryPicker } from "@/features/categories/CategoryPicker";
import { type TaskActionResult } from "@/server/actions/task-actions";
import { validateTransition } from "@/server/tasks/rules";
import { TRANSITION_REJECTED_MESSAGE } from "@/server/actions/task-messages";
import type { CategoryDto } from "@/server/categories/service";

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
 *
 * F004 (T016/T017): the category assignment renders via CategoryPicker —
 * "No category" is the default and assignment is never forced (FR-006);
 * with no categories yet the picker degrades to an empty state that links
 * to /categories. The server resolves the submitted id against the owner
 * (FR-005) — a foreign id surfaces the friendly CATEGORY_GONE message.
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
  /** F004: the edit surface's current assignment; "" / null = no category. */
  categoryId?: string | null;
};

const INITIAL_STATE = null;

export function TaskForm({
  action,
  initial,
  submitLabel = "Create task",
  cancelLabel,
  onCancel,
  taskId,
  categories = [],
}: {
  action: TaskFormAction;
  initial?: TaskFormValues;
  submitLabel?: string;
  /** When set, a Cancel button renders next to submit (edit surface, US4). */
  cancelLabel?: string;
  onCancel?: () => void;
  /** When set, submitted as a hidden `taskId` field (edit surface, US4). */
  taskId?: string;
  /** F004: the owner's categories for the assignment picker (may be empty). */
  categories?: CategoryDto[];
}) {
  // D8 single-flight guard: the disabled button blocks user re-submission,
  // but a synchronous burst of submissions (e.g. scripted rapid clicks, D12
  // S11) is queued by React's action queue and dispatched SEQUENTIALLY —
  // each queued dispatch runs only after the previous action resolved, when
  // the in-flight ref is already null. Two guards are therefore needed: the
  // in-flight ref returns the SAME promise for concurrent dispatches, and
  // `succeededRef` blocks any dispatch after a success — on success the
  // surface closes (SC-001), so later dispatches are stragglers that must
  // not create another task.
  const inFlightRef = useRef<Promise<TaskActionResult> | null>(null);
  const succeededRef = useRef(false);
  const formAction = useCallback(
    async (
      prev: TaskActionResult | null,
      formData: FormData,
    ): Promise<TaskActionResult> => {
      if (succeededRef.current) {
        // A success already settled this form (the surface closes on
        // success, SC-001) — prev is that success result, so straggler
        // dispatches re-return it instead of hitting the server again.
        return prev as TaskActionResult;
      }
      if (inFlightRef.current) return inFlightRef.current;
      const promise = action(prev, formData)
        .then((result) => {
          if (result.status === "success") succeededRef.current = true;
          return result;
        })
        .finally(() => {
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

  // US4 (T029, D2): the shared `validateTransition` runs CLIENT-side so a
  // backward status pick (e.g. IN_PROGRESS → TODO) shows the inline `status`
  // field error BEFORE any submit — the server re-checks it anyway (D2).
  // Same-status picks are no-ops, never violations. The check derives from
  // the CURRENT select value and the task's stored status via the documented
  // "adjust state during render" pattern (no setState inside effects).
  const [clientStatusError, setClientStatusError] = useState<string | null>(
    null,
  );
  const [seenStatus, setSeenStatus] = useState(status);
  if (status !== seenStatus) {
    setSeenStatus(status);
    setClientStatusError(
      initial?.status &&
        status !== initial.status &&
        !validateTransition(initial.status, status)
        ? TRANSITION_REJECTED_MESSAGE
        : null,
    );
  }

  const fieldErrors =
    state?.status === "validation_error" ? state.fieldErrors : [];
  const errorFor = (field: string) =>
    fieldErrors.find((fieldError) => fieldError.field === field)?.message;

  const inputClassName =
    "border-border bg-background focus-visible:outline-ring rounded-md border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <form action={formActionBase} className="flex flex-col gap-4" noValidate>
      {taskId && <input type="hidden" name="taskId" value={taskId} />}
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
          aria-invalid={errorFor("status") ? true : false}
          aria-describedby={
            errorFor("status") ? "task-status-error" : undefined
          }
          onChange={(event) => {
            setStatus(
              (event.target.value as TaskFormValues["status"]) ?? "TODO",
            );
          }}
          className={inputClassName}
        >
          <option value="TODO">To do</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
        {(clientStatusError ?? errorFor("status")) && (
          <p id="task-status-error" className="text-sm text-red-600">
            {clientStatusError ?? errorFor("status")}
          </p>
        )}
      </div>

      {/* F004 (T016): the assignment picker — self-degrading to an empty
          state when the user has no categories yet (FR-006). */}
      <CategoryPicker
        categories={categories}
        initialCategoryId={initial?.categoryId ?? undefined}
      />
      {errorFor("categoryId") && (
        <p id="task-category-error" className="text-sm text-red-600">
          {errorFor("categoryId")}
        </p>
      )}

      {state?.status === "failure" && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}

      <div className="flex gap-2">
        {cancelLabel && onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <Button
          type="submit"
          disabled={isPending || clientStatusError !== null}
        >
          {isPending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
