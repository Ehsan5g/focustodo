"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CategoryDto } from "@/server/categories/service";
import { CategoryForm } from "@/features/categories/CategoryForm";
import { useCreateCategorySurfaceOptional } from "@/features/categories/create-category-surface";
import {
  updateCategoryAction,
  type CategoryActionResult,
} from "@/server/actions/category-actions";

/**
 * CategoryList (feature 004-task-categories, T013; contracts/
 * routes-and-surfaces.md) — the user's categories in the RECEIVED order:
 * the service orders by `nameKey` asc (case-insensitive alphabetical,
 * FR-005), so the list renders the server's order as-is — never re-sorted.
 * The empty state (FR-012) offers a clear create action opening the same
 * adaptive create surface as the page header's "New category" control.
 * Each row owns its per-row controls (F003's TaskItem pattern, D8):
 * rename (T026) and delete (T031).
 */
export function CategoryList({
  categories,
  onCreateClick,
}: {
  categories: CategoryDto[];
  onCreateClick?: () => void;
}) {
  // Under the page provider the empty state opens the shared surface;
  // standalone (component tests) the injected prop wins.
  const surface = useCreateCategorySurfaceOptional();
  const open = onCreateClick ?? (() => surface?.openCreateSurface());

  if (categories.length === 0) {
    return (
      <div
        data-testid="category-empty-state"
        className="border-border rounded-xl border border-dashed p-8 text-center"
      >
        <p className="text-muted-foreground mb-4">
          No categories yet. Group your tasks by giving one a name.
        </p>
        <button
          type="button"
          onClick={open}
          className="bg-primary text-primary-foreground focus-visible:outline-ring inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
          data-testid="empty-state-create-category"
        >
          <span aria-hidden="true">＋</span>
          Create your first category
        </button>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="category-list">
      {categories.map((category) => (
        <CategoryItem key={category.id} category={category} />
      ))}
    </ul>
  );
}

const controlClass =
  "text-muted-foreground focus-visible:outline-ring rounded-md p-1.5 text-sm hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2";

/**
 * One row (T026): the readable name plus its per-row controls. The rename
 * control opens the SAME adaptive surface pattern as create (Dialog on
 * desktop ≥sm, bottom Sheet on mobile <sm, research D7) PRE-FILLED from the
 * row's DTO: "Cancel" closes with zero mutations, success closes the surface
 * (the action revalidates both surfaces). Native elements, no Radix
 * dependency: Escape closes, backdrop click closes, focus moves into the
 * form (FR-014). The form remounts on every open, so the pre-fill always
 * shows the CURRENT server state — including a rename from another tab.
 */
function CategoryItem({ category }: { category: CategoryDto }) {
  const [renameOpen, setRenameOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!renameOpen) return;
    focusedRef.current = false;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setRenameOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [renameOpen]);

  useEffect(() => {
    if (renameOpen && !focusedRef.current && dialogRef.current) {
      const first = dialogRef.current.querySelector<HTMLElement>(
        "input, select, textarea, button",
      );
      first?.focus();
      focusedRef.current = true;
    }
  }, [renameOpen]);

  const handleRenameAction = useCallback(
    async (
      prev: CategoryActionResult | null,
      formData: FormData,
    ): Promise<CategoryActionResult> => {
      const result = await updateCategoryAction(prev, formData);
      if (result.status === "success") setRenameOpen(false);
      return result;
    },
    [],
  );

  return (
    <li
      data-testid="category-item"
      className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
    >
      <span className="truncate font-medium" data-testid="category-name">
        {category.name}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          data-testid="rename-category"
          aria-label={`Rename ${category.name}`}
          onClick={() => setRenameOpen(true)}
          className={controlClass}
        >
          <span aria-hidden="true">✎</span> Rename
        </button>
      </div>
      {renameOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setRenameOpen(false);
          }}
        >
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden="true"
            onClick={() => setRenameOpen(false)}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Rename category"
            data-testid="rename-category-surface"
            className="bg-card relative w-full max-w-lg rounded-t-xl border p-6 shadow-lg sm:rounded-xl"
          >
            <h2 className="mb-4 text-lg font-semibold">Rename category</h2>
            <CategoryForm
              action={handleRenameAction}
              initial={{ name: category.name }}
              categoryId={category.id}
              submitLabel="Save changes"
              cancelLabel="Cancel"
              onCancel={() => setRenameOpen(false)}
            />
          </div>
        </div>
      )}
    </li>
  );
}
