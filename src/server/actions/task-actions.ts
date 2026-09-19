"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/server/auth/session";
import {
  createTask as createTaskInService,
  type TaskDto,
} from "@/server/tasks/service";
import { GENERIC_FAILURE_MESSAGE } from "@/server/actions/task-messages";
import { createTaskSchema } from "@/validation/task-schema";

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

// __CREATE_TASK__
