"use client";

import { useActionState, useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { type CategoryActionResult } from "@/server/actions/category-actions";

/**
 * CategoryForm (feature 004-task-categories, T014; contracts/
 * routes-and-surfaces.md) — the shared create/rename form (rename prefill
 * lands with US3 via the `initial` prop). ONE labeled field; inline errors
 * adjacent to the field; the submit button is disabled while pending so
 * rapid double-submits create at most one category (D8). Validation is
 * enforced by the shared `createCategorySchema` on the server; the
 * whitespace-only check ALSO runs client-side as a UX fast path so a
 * spaces-only submit never reaches the server (S3, zero action calls) — the
 * server remains authoritative (constitution II).
 *
 * Fields are CONTROLLED (the F003 lesson: React resets uncontrolled inputs
 * after a server-action submission, wiping typed input on a validation
 * error).
 *
 * The action is injected as a prop so component tests (T009) can substitute
 * a mock; the page passes the real `createCategoryAction` (T014).
 */

export type CategoryFormAction = (
  state: CategoryActionResult | null,
  formData: FormData,
) => Promise<CategoryActionResult>;

const INITIAL_STATE = null;

export function CategoryForm({
  action,
  initial,
  submitLabel = "Create category",
  cancelLabel,
  onCancel,
  categoryId,
}: {
  action: CategoryFormAction;
  /** Prefill for the rename form (US3); create mode starts empty. */
  initial?: { name?: string };
  submitLabel?: string;
  /** When set, a Cancel button renders next to submit (rename surface, US3). */
  cancelLabel?: string;
  onCancel?: () => void;
  /** When set, submitted as a hidden `categoryId` field (rename, US3). */
  categoryId?: string;
}) {
  // D8 single-flight guard — identical to TaskForm: the disabled button
  // blocks user re-submission, the in-flight ref returns the SAME promise
  // for concurrent dispatches, and `succeededRef` blocks stragglers after a
  // success (the surface closes on success, SC-001).
  const inFlightRef = useRef<Promise<CategoryActionResult> | null>(null);
  const succeededRef = useRef(false);
  const formAction = useCallback(
    async (
      prev: CategoryActionResult | null,
      formData: FormData,
    ): Promise<CategoryActionResult> => {
      if (succeededRef.current) {
        return prev as CategoryActionResult;
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
  const [name, setName] = useState(initial?.name ?? "");

  // S3 UX fast path (zero action calls): a NON-EMPTY value that trims to
  // nothing is invalid before the server ever sees it. Render-time
  // derivation via the documented "adjust state during render" pattern (no
  // setState inside effects).
  const [clientNameError, setClientNameError] = useState<string | null>(null);
  const [seenName, setSeenName] = useState(name);
  if (name !== seenName) {
    setSeenName(name);
    setClientNameError(
      name.length > 0 && name.trim().length === 0
        ? "Category name is required"
        : null,
    );
  }

  const fieldErrors =
    state?.status === "validation_error" ? state.fieldErrors : [];
  const serverError = fieldErrors.find(
    (fieldError) => fieldError.field === "name",
  )?.message;
  const nameError = clientNameError ?? serverError;

  const inputClassName =
    "border-border bg-background focus-visible:outline-ring rounded-md border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <form action={formActionBase} className="flex flex-col gap-4" noValidate>
      {categoryId && (
        <input type="hidden" name="categoryId" value={categoryId} />
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="category-name">Category name</label>
        <input
          id="category-name"
          name="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={nameError ? true : false}
          aria-describedby={nameError ? "category-name-error" : undefined}
          data-testid="category-name-input"
          className={inputClassName}
        />
        {nameError && (
          <p id="category-name-error" className="text-sm text-red-600">
            {nameError}
          </p>
        )}
      </div>

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
        <Button type="submit" disabled={isPending || clientNameError !== null}>
          {isPending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
