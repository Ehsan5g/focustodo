"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  CATEGORY_GONE_MESSAGE,
  DUPLICATE_NAME_MESSAGE,
  GENERIC_FAILURE_MESSAGE,
} from "@/server/actions/category-messages";
import { requireSession } from "@/server/auth/session";
import {
  createCategory as createCategoryInService,
  deleteCategory as deleteCategoryInService,
  updateCategory as updateCategoryInService,
  type CategoryDto,
} from "@/server/categories/service";
import {
  categoryIdSchema,
  createCategorySchema,
  updateCategorySchema,
} from "@/validation/category-schema";

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

/**
 * updateCategory (T025) — the five steps, in order:
 * 1. Validate the id AND the body through the shared schemas — a malformed
 *    id is indistinguishable from a gone one (one friendly message, D4).
 * 2. Authenticate: requireSession() derives the owner id.
 * 3+4. Authorize + execute: ownership IS the service's lookup predicate;
 *    the service's `duplicate` reason (P2002 against a DIFFERENT category)
 *    maps to one friendly name field error (D1), `not_found` covers
 *    unknown/foreign/already-deleted ids (D4).
 * 5. Return the union — never a raw DB object — and revalidate BOTH
 *    surfaces: the management list AND the tasks page (the assignment
 *    picker and the joined task labels propagate by reference, FR-011).
 */
export async function updateCategoryAction(
  _prev: CategoryActionResult | null,
  formData: FormData,
): Promise<CategoryActionResult> {
  // Step 1: validate.
  const parsedId = categoryIdSchema.safeParse(formData.get("categoryId"));
  const parsed = updateCategorySchema.safeParse({
    name: formData.get("name") ?? "",
  });
  if (!parsedId.success) {
    return { status: "failure", message: CATEGORY_GONE_MESSAGE };
  }
  if (!parsed.success) return validationError(parsed.error);

  // Step 2: authenticate.
  const session = await requireSession();
  if (!session) {
    return { status: "failure", message: "Please sign in to continue." };
  }

  // Steps 3+4: authorize + execute — ownership IS the lookup predicate.
  try {
    const result = await updateCategoryInService(
      session.user.id,
      parsedId.data,
      parsed.data,
    );
    if (!result.ok) {
      if (result.reason === "not_found") {
        return { status: "failure", message: CATEGORY_GONE_MESSAGE };
      }
      return {
        status: "validation_error",
        fieldErrors: [{ field: "name", message: DUPLICATE_NAME_MESSAGE }],
      };
    }
    // Step 5: return + revalidate both surfaces (labels propagate by
    // reference — the picker and the joined badges re-read the current name).
    revalidatePath("/categories");
    revalidatePath("/");
    return { status: "success", category: result.category };
  } catch (error) {
    const diagnostic =
      error instanceof Error ? error.message : "unexpected error shape";
    process.stderr.write(`updateCategoryAction failed: ${diagnostic}\n`);
    return { status: "failure", message: GENERIC_FAILURE_MESSAGE };
  }
}

export type CategoryDeleteResult =
  { status: "success" } | { status: "failure"; message: string };

/**
 * deleteCategory (T030) — the five steps, in order:
 * 1. Validate the id through the shared `categoryIdSchema` — a malformed id
 *    is indistinguishable from a gone one (one friendly message, D4).
 * 2. Authenticate: requireSession() derives the owner id.
 * 3+4. Authorize + execute: ownership IS the deletion predicate — the
 *    service's owner-scoped `deleteMany` (F003's D10 pattern). A `false`
 *    stops everything: foreign, already-deleted, and unknown ids are
 *    indistinguishable (D4). The `SetNull` FK nulls ONLY the task links —
 *    the tasks themselves keep every other field (D2, FR-011).
 * 5. Return the union — never a raw DB object — and revalidate BOTH
 *    surfaces: the management list AND the tasks page (badges drop by
 *    reference, zero task writes).
 */
export async function deleteCategoryAction(
  categoryId: string,
): Promise<CategoryDeleteResult> {
  // Step 1: validate.
  const parsedId = categoryIdSchema.safeParse(categoryId);
  if (!parsedId.success) {
    return { status: "failure", message: CATEGORY_GONE_MESSAGE };
  }

  // Step 2: authenticate.
  const session = await requireSession();
  if (!session) {
    return { status: "failure", message: "Please sign in to continue." };
  }

  // Steps 3+4: authorize + execute — ownership IS the deletion predicate.
  try {
    const deleted = await deleteCategoryInService(
      session.user.id,
      parsedId.data,
    );
    if (!deleted) {
      return { status: "failure", message: CATEGORY_GONE_MESSAGE };
    }
    // Step 5: return + revalidate both surfaces (the task badges drop).
    revalidatePath("/categories");
    revalidatePath("/");
    return { status: "success" };
  } catch (error) {
    const diagnostic =
      error instanceof Error ? error.message : "unexpected error shape";
    process.stderr.write(`deleteCategoryAction failed: ${diagnostic}\n`);
    return { status: "failure", message: GENERIC_FAILURE_MESSAGE };
  }
}
