"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/server/auth/session";
import {
  createTask as createTaskInService,
  deleteTask as deleteTaskInService,
  setTaskStatus as setTaskStatusInService,
  updateTask as updateTaskInService,
  type TaskDto,
} from "@/server/tasks/service";
import {
  GENERIC_FAILURE_MESSAGE,
  TASK_GONE_MESSAGE,
  TRANSITION_REJECTED_MESSAGE,
} from "@/server/actions/task-messages";
import {
  createTaskSchema,
  taskIdSchema,
  updateTaskSchema,
} from "@/validation/task-schema";

/**
 * Task server actions (feature 003-task-management, contracts/
 * server-actions.md) — the ONLY client-facing mutation surface. Every action
 * shows the five steps in order: (1) validate, (2) authenticate via
 * requireSession(), (3) authorize, (4) execute via the task service,
 * (5) return the predictable union — never a raw DB object.
 *
 * Invariants (constitution I, data-model.md):
 * - `userId` NEVER comes from the client; it is derived from requireSession().
 * - Raw Prisma objects never cross the boundary — DTO mapping only.
 * - No task content is ever logged (constitution V).
 * - Client inputs are re-validated server-side even though the client also
 *   validates (the shared Zod schemas are the single source, constitution II).
 */

export type TaskFieldErrors = {
  field: "title" | "description" | "dueDate" | "priority" | "status";
  message: string;
}[];

export type TaskActionResult =
  | { status: "success"; task: TaskDto }
  | { status: "validation_error"; fieldErrors: TaskFieldErrors }
  | { status: "failure"; message: string };

/** deleteTask's narrower result — no task is returned (it is gone). */
export type DeleteTaskResult =
  { status: "success" } | { status: "failure"; message: string };

const ACTION_FIELDS = [
  "title",
  "description",
  "dueDate",
  "priority",
  "status",
] as const;

function validationError(zodError: z.ZodError): TaskActionResult {
  const fieldErrors: TaskFieldErrors = [];
  for (const issue of zodError.issues) {
    const field = issue.path[0];
    if (
      typeof field === "string" &&
      (ACTION_FIELDS as readonly string[]).includes(field)
    ) {
      fieldErrors.push({
        field: field as TaskFieldErrors[number]["field"],
        message: issue.message || "Please check this field",
      });
    }
  }
  return { status: "validation_error", fieldErrors };
}

/**
 * createTask (T013) — the five steps, in order:
 * 1. Validate the FormData through the shared `createTaskSchema`.
 * 2. Authenticate: requireSession() derives the owner id.
 * 3. Authorize: creating into one's own list is always allowed — the owner id
 *    never comes from the client.
 * 4. Execute via the task service (any valid initial status accepted).
 * 5. Return the TaskActionResult union — never a raw DB object — and
 *    revalidate the list.
 */
export async function createTaskAction(
  _prev: TaskActionResult | null,
  formData: FormData,
): Promise<TaskActionResult> {
  // Step 1: validate.
  const parsed = createTaskSchema.safeParse({
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    dueDate: formData.get("dueDate") || undefined,
    priority: formData.get("priority") || undefined,
    status: formData.get("status") || undefined,
  });
  if (!parsed.success) return validationError(parsed.error);

  // Step 2: authenticate.
  const session = await requireSession();
  if (!session) {
    return { status: "failure", message: "Please sign in to continue." };
  }

  // Step 3: authorize — the owner id comes ONLY from the session; there is
  // nothing further to check for a create into one's own list.

  // Step 4: execute.
  try {
    const task = await createTaskInService(session.user.id, parsed.data);
    // Step 5: return + revalidate the list.
    revalidatePath("/");
    return { status: "success", task };
  } catch (error) {
    // Server-side diagnostic (constitution V): message only — no task
    // content, no stack internals beyond the error's own message.
    const diagnostic =
      error instanceof Error ? error.message : "unexpected error shape";
    process.stderr.write(`createTaskAction failed: ${diagnostic}\n`);
    return { status: "failure", message: GENERIC_FAILURE_MESSAGE };
  }
}

/**
 * setTaskStatus (T023) — the single-interaction complete/reopen path
 * (client side is optimistic, D3). The five steps, in order:
 * 1. Validate `taskIdSchema` + the status enum shape.
 * 2. Authenticate: requireSession().
 * 3. Authorize: scoped lookup via the service — foreign/unknown id is the
 *    SAME friendly failure (D9).
 * 4. Execute: same-status no-op → success; the shared `validateTransition`
 *    matrix rejects backward pairs with a `status` field error (D2).
 * 5. Return the TaskActionResult union + revalidate the list.
 */
export async function setTaskStatusAction(
  taskId: string,
  next: string,
): Promise<TaskActionResult> {
  // Step 1: validate (param shapes — never user task content).
  const parsedId = taskIdSchema.safeParse(taskId);
  const parsedStatus = z
    .enum(["TODO", "IN_PROGRESS", "COMPLETED"])
    .safeParse(next);
  if (!parsedId.success || !parsedStatus.success) {
    return {
      status: "validation_error",
      fieldErrors: [{ field: "status", message: "Invalid request" }],
    };
  }

  // Step 2: authenticate.
  const session = await requireSession();
  if (!session) {
    return { status: "failure", message: "Please sign in to continue." };
  }

  // Step 3 + 4: authorize + execute in one scoped service call.
  try {
    const result = await setTaskStatusInService(
      session.user.id,
      parsedId.data,
      parsedStatus.data,
    );
    if (result.ok) {
      // Step 5: return + revalidate the list.
      revalidatePath("/");
      return { status: "success", task: result.task };
    }
    if (result.reason === "not_found") {
      return { status: "failure", message: TASK_GONE_MESSAGE };
    }
    return {
      status: "validation_error",
      fieldErrors: [{ field: "status", message: TRANSITION_REJECTED_MESSAGE }],
    };
  } catch (error) {
    const diagnostic =
      error instanceof Error ? error.message : "unexpected error shape";
    process.stderr.write(`setTaskStatusAction failed: ${diagnostic}\n`);
    return { status: "failure", message: GENERIC_FAILURE_MESSAGE };
  }
}

/**
 * updateTask (T028) — the five steps, in order (contracts/server-actions.md):
 * 1. Validate via `taskIdSchema` + `updateTaskSchema` (same field rules as
 *    create; cleared optionals arrive as empty strings and normalize to null).
 * 2. Authenticate: requireSession().
 * 3. Authorize: the service loads scoped `where { id, userId }` — a foreign,
 *    unknown, or already-deleted id is the SAME friendly failure (D9).
 * 4. Execute: the shared `validateTransition` rejects a backward status with
 *    a `status` field error and leaves the row untouched; cleared optionals
 *    persist as null (FR-007).
 * 5. Return the TaskActionResult union + revalidate the list.
 */
export async function updateTaskAction(
  _prev: TaskActionResult | null,
  formData: FormData,
): Promise<TaskActionResult> {
  // Step 1: validate (id + the partial field set).
  const parsedId = taskIdSchema.safeParse(formData.get("taskId"));
  if (!parsedId.success) {
    return { status: "failure", message: TASK_GONE_MESSAGE };
  }
  const parsed = updateTaskSchema.safeParse({
    title: formData.has("title") ? (formData.get("title") ?? "") : undefined,
    description: formData.has("description")
      ? (formData.get("description") ?? "")
      : undefined,
    dueDate: formData.has("dueDate")
      ? formData.get("dueDate") || null
      : undefined,
    priority: formData.has("priority")
      ? formData.get("priority") || undefined
      : undefined,
    status: formData.has("status")
      ? formData.get("status") || undefined
      : undefined,
  });
  if (!parsed.success) return validationError(parsed.error);

  // Step 2: authenticate.
  const session = await requireSession();
  if (!session) {
    return { status: "failure", message: "Please sign in to continue." };
  }

  // Step 3 + 4: authorize + execute in one scoped service call.
  try {
    const result = await updateTaskInService(
      session.user.id,
      parsedId.data,
      parsed.data,
    );
    if (result.ok) {
      // Step 5: return + revalidate the list.
      revalidatePath("/");
      return { status: "success", task: result.task };
    }
    if (result.reason === "not_found") {
      return { status: "failure", message: TASK_GONE_MESSAGE };
    }
    return {
      status: "validation_error",
      fieldErrors: [{ field: "status", message: TRANSITION_REJECTED_MESSAGE }],
    };
  } catch (error) {
    const diagnostic =
      error instanceof Error ? error.message : "unexpected error shape";
    process.stderr.write(`updateTaskAction failed: ${diagnostic}\n`);
    return { status: "failure", message: GENERIC_FAILURE_MESSAGE };
  }
}

/**
 * deleteTask (T033) — the five steps, in order:
 * 1. Validate via `taskIdSchema`.
 * 2. Authenticate: requireSession().
 * 3. Authorize: ownership IS the deletion predicate (D10).
 * 4. Execute: scoped `deleteMany { id, userId }` via the service — an
 *    affected count of 0 means unknown, foreign, or already-deleted, all the
 *    SAME friendly failure (D9).
 * 5. Return the result union + revalidate the list.
 */
export async function deleteTaskAction(
  taskId: string,
): Promise<DeleteTaskResult> {
  // Step 1: validate.
  const parsedId = taskIdSchema.safeParse(taskId);
  if (!parsedId.success) {
    return { status: "failure", message: TASK_GONE_MESSAGE };
  }

  // Step 2: authenticate.
  const session = await requireSession();
  if (!session) {
    return { status: "failure", message: "Please sign in to continue." };
  }

  // Step 3 + 4: authorize + execute in one scoped service call.
  try {
    const deleted = await deleteTaskInService(session.user.id, parsedId.data);
    if (!deleted) {
      return { status: "failure", message: TASK_GONE_MESSAGE };
    }
    // Step 5: return + revalidate the list.
    revalidatePath("/");
    return { status: "success" };
  } catch (error) {
    const diagnostic =
      error instanceof Error ? error.message : "unexpected error shape";
    process.stderr.write(`deleteTaskAction failed: ${diagnostic}\n`);
    return { status: "failure", message: GENERIC_FAILURE_MESSAGE };
  }
}
