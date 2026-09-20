import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  CreateTaskSurfaceProvider,
  NewTaskButton,
} from "@/features/tasks/create-task-surface";
import { TaskList } from "@/features/tasks/TaskList";
import { requireSession } from "@/server/auth/session";
import { listCategories } from "@/server/categories/service";
import { listTasks } from "@/server/tasks/service";

/**
 * The task list view (feature 003-task-management, T018; F004 T017; contracts/
 * routes-and-surfaces.md) — the signed-in user's tasks, newest-first.
 *
 * Server Component, ONE scoped query per entity via the services (`where
 * { userId }`, UI fields only — the task read joins the category NAME for the
 * list badge, D5); rows are mapped to DTOs inside the services before
 * crossing to any client component (D4, constitution I). No client fetch, no
 * raw Prisma objects in props. Overdue is derived in the render layer with an
 * injected `today` (D1: one clock read per render, never inside components).
 */
export default async function TaskListView() {
  const session = await requireSession();
  // The (protected) layout guarantees a session; this narrows the queries.
  // F004: the same session's categories feed BOTH the create surface's
  // picker and each row's edit surface — two scoped reads, one render.
  const [tasks, categories] = session
    ? await Promise.all([
        listTasks(session.user.id),
        listCategories(session.user.id),
      ])
    : [[], []];
  const today = new Date();

  return (
    <CreateTaskSurfaceProvider categories={categories}>
      <main
        id="main-content"
        className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">My tasks</h1>
          <div className="flex items-center gap-3">
            <NewTaskButton />
            <ThemeToggle />
          </div>
        </div>
        <TaskList tasks={tasks} today={today} categories={categories} />
      </main>
    </CreateTaskSurfaceProvider>
  );
}
