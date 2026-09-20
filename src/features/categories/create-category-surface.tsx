"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { CategoryForm } from "@/features/categories/CategoryForm";
import {
  createCategoryAction,
  type CategoryActionResult,
} from "@/server/actions/category-actions";

/**
 * Create-category surface context (feature 004-task-categories, T014;
 * contracts/routes-and-surfaces.md) — ONE adaptive create surface shared by
 * the page header's "New category" control and the empty state's
 * create-your-first-category action (FR-012): a bottom Sheet below `sm` and
 * a centered Dialog at `sm` and above (research D7 — F003's native-element
 * pattern; Radix is not a dependency). Escape closes, backdrop click
 * closes, focus moves into the form (FR-013).
 *
 * On success the action revalidates the list; the surface closes (SC-001).
 */

type CreateCategorySurface = { openCreateSurface: () => void };

const CreateCategorySurfaceContext =
  createContext<CreateCategorySurface | null>(null);

export function useCreateCategorySurface(): CreateCategorySurface {
  const context = useContext(CreateCategorySurfaceContext);
  if (!context) {
    throw new Error(
      "useCreateCategorySurface must be used inside CreateCategorySurfaceProvider",
    );
  }
  return context;
}

/** Non-throwing variant for components rendered both inside and outside. */
export function useCreateCategorySurfaceOptional(): CreateCategorySurface | null {
  return useContext(CreateCategorySurfaceContext);
}

export function CreateCategorySurfaceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const openCreateSurface = useCallback(() => setOpen(true), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleAction = useCallback(
    async (
      prev: CategoryActionResult | null,
      formData: FormData,
    ): Promise<CategoryActionResult> => {
      const result = await createCategoryAction(prev, formData);
      if (result.status === "success") setOpen(false);
      return result;
    },
    [],
  );

  return (
    <CreateCategorySurfaceContext.Provider value={{ openCreateSurface }}>
      {children}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="New category"
            data-testid="new-category-surface"
            className="bg-card relative w-full max-w-lg rounded-t-xl border p-6 shadow-lg sm:rounded-xl"
          >
            <h2 className="mb-4 text-lg font-semibold">New category</h2>
            <CategoryForm action={handleAction} />
          </div>
        </div>
      )}
    </CreateCategorySurfaceContext.Provider>
  );
}

/** The page header trigger (T014) — opens the same adaptive surface. */
export function NewCategoryButton() {
  const { openCreateSurface } = useCreateCategorySurface();
  return (
    <Button onClick={openCreateSurface} data-testid="new-category-button">
      New category
    </Button>
  );
}
