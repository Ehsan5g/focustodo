import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  CreateCategorySurfaceProvider,
  NewCategoryButton,
} from "@/features/categories/create-category-surface";
import { CategoryList } from "@/features/categories/CategoryList";
import { requireSession } from "@/server/auth/session";
import { listCategories } from "@/server/categories/service";

/**
 * The category management view (feature 004-task-categories, T013;
 * contracts/routes-and-surfaces.md) — the signed-in user's categories,
 * case-insensitively alphabetical.
 *
 * Server Component, ONE scoped query via the category service
 * (`where { userId }`, `orderBy nameKey asc`, ONLY `id`/`name` — D9);
 * rows are mapped to `CategoryDto` inside the service before crossing to
 * any client component (constitution I). No client fetch, no raw Prisma
 * objects in props.
 */
export default async function CategoriesPage() {
  const session = await requireSession();
  // The (protected) layout guarantees a session; this narrows for the query.
  const categories = session ? await listCategories(session.user.id) : [];

  return (
    <CreateCategorySurfaceProvider>
      <main
        id="main-content"
        className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Categories</h1>
          <div className="flex items-center gap-3">
            <NewCategoryButton />
            <ThemeToggle />
          </div>
        </div>
        <CategoryList categories={categories} />
      </main>
    </CreateCategorySurfaceProvider>
  );
}
