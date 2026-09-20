"use client";

import type { CategoryDto } from "@/server/categories/service";
import { useCreateCategorySurfaceOptional } from "@/features/categories/create-category-surface";

/**
 * CategoryList (feature 004-task-categories, T013; contracts/
 * routes-and-surfaces.md) — the user's categories in the RECEIVED order:
 * the service orders by `nameKey` asc (case-insensitive alphabetical,
 * FR-005), so the list renders the server's order as-is — never re-sorted.
 * The empty state (FR-012) offers a clear create action opening the same
 * adaptive create surface as the page header's "New category" control.
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
        <li
          key={category.id}
          data-testid="category-item"
          className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
        >
          <span className="truncate font-medium" data-testid="category-name">
            {category.name}
          </span>
          {/* Rename/delete row controls land with US3 (T026) and US4 (T031). */}
        </li>
      ))}
    </ul>
  );
}
