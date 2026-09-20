import Link from "next/link";

import type { CategoryDto } from "@/server/categories/service";

/**
 * CategoryPicker (feature 004-task-categories, T016; contracts/
 * routes-and-surfaces.md) — the single-select assignment control inside the
 * shared task form (create AND edit). "No category" is the first option and
 * the default (FR-006: assignment is never forced); options render in the
 * order the SERVER sent them — case-insensitively alphabetical (FR-005); the
 * service owns ordering, the picker only renders (D5). The select posts as
 * `categoryId`: "" parses to null on the server (clear), an option value is
 * the link.
 *
 * With no categories yet it degrades to an inline empty state whose next
 * action links to the management page (FR-006/D5: creation is never forced
 * from the task form).
 */
export function CategoryPicker({
  categories,
  initialCategoryId,
}: {
  categories: CategoryDto[];
  /** The edit surface's current assignment; "" / undefined = no category. */
  initialCategoryId?: string;
}) {
  if (categories.length === 0) {
    return (
      <div
        data-testid="category-picker-empty"
        className="flex flex-col gap-1.5"
      >
        <span className="text-muted-foreground text-sm">
          You have no categories yet — tasks work without one.
        </span>
        <Link
          href="/categories"
          className="text-sm font-medium underline underline-offset-2 hover:opacity-80"
        >
          Create a category
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="task-category">Category</label>
      {/* Uncontrolled: "" = No category (parses to null on the server, D1). */}
      <select
        id="task-category"
        name="categoryId"
        defaultValue={initialCategoryId ?? ""}
        className="border-border bg-background focus-visible:outline-ring rounded-md border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <option value="">No category</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </div>
  );
}
