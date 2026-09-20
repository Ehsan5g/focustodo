"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  DUPLICATE_NAME_MESSAGE,
  GENERIC_FAILURE_MESSAGE,
} from "@/server/actions/category-messages";
import { requireSession } from "@/server/auth/session";
import {
  createCategory as createCategoryInService,
  type CategoryDto,
} from "@/server/categories/service";
import { createCategorySchema } from "@/validation/category-schema";

/**
 * Category server actions (feature 004-task-categories, contracts/
 * server-actions.md) — the ONLY client-facing category mutation surface.
 * Every action shows the five steps in order: (1) validate, (2)
 * authenticate via requireSession(), (3) authorize, (4) execute via the
 * category service, (5) return the predictable union — never a raw DB
 * object.
 *
 * Invariants (constitution I, data-model.md):
 * - `userId` NEVER comes from the client; it is derived from requireSession().
 * - `nameKey` is never accepted from a client and never returned (D1/D9).
 * - No category content is ever logged (constitution V).
 * - Client inputs are re-validated server-side even though the client also
 *   validates (the shared Zod schemas are the single source, constitution II).
 */

export type CategoryFieldErrors = {
  field: "name";
  message: string;
}[];

export type CategoryActionResult =
  | { status: "success"; category: CategoryDto }
  | { status: "validation_error"; fieldErrors: CategoryFieldErrors }
  | { status: "failure"; message: string }; // generic, friendly; no internals

const CATEGORY_FIELDS = ["name"] as const;

function validationError(zodError: z.ZodError): CategoryActionResult {
  const fieldErrors: CategoryFieldErrors = [];
  for (const issue of zodError.issues) {
    const field = issue.path[0];
    if (
      typeof field === "string" &&
      (CATEGORY_FIELDS as readonly string[]).includes(field)
    ) {
      fieldErrors.push({
        field: field as CategoryFieldErrors[number]["field"],
        message: issue.message || "Please check this field",
      });
    }
  }
  return { status: "validation_error", fieldErrors };
}

/**
 * createCategory (T012) — the five steps, in order:
 * 1. Validate the FormData through the shared `createCategorySchema`.
 * 2. Authenticate: requireSession() derives the owner id.
 * 3. Authorize: creating into one's own list is always allowed — the owner
 *    id never comes from the client.
 * 4. Execute via the category service (nameKey derived at the write
 *    boundary; the P2002 unique violation maps to the duplicate field
 *    error).
 * 5. Return the CategoryActionResult union — never a raw DB object — and
 *    revalidate the category list.
 */
export async function createCategoryAction(
  _prev: CategoryActionResult | null,
  formData: FormData,
): Promise<CategoryActionResult> {
  // Step 1: validate.
  const parsed = createCategorySchema.safeParse({
    name: formData.get("name") ?? "",
  });
  if (!parsed.success) return validationError(parsed.error);

  // Step 2: authenticate.
  const session = await requireSession();
  if (!session) {
    return { status: "failure", message: "Please sign in to continue." };
  }

  // Step 3: authorize — creating into one's own list is always allowed; the
  // owner id comes from the session, never from the client.

  // Step 4: execute.
  try {
    const result = await createCategoryInService(session.user.id, parsed.data);
    if (!result.ok) {
      return {
        status: "validation_error",
        fieldErrors: [{ field: "name", message: DUPLICATE_NAME_MESSAGE }],
      };
    }
    // Step 5: return + revalidate the list.
    revalidatePath("/categories");
    return { status: "success", category: result.category };
  } catch (error) {
    const diagnostic =
      error instanceof Error ? error.message : "unexpected error shape";
    process.stderr.write(`createCategoryAction failed: ${diagnostic}\n`);
    return { status: "failure", message: GENERIC_FAILURE_MESSAGE };
  }
}
