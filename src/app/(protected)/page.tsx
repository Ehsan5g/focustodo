import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  CreateTaskSurfaceProvider,
  NewTaskButton,
} from "@/features/tasks/create-task-surface";
import { TaskList } from "@/features/tasks/TaskList";
import { requireSession } from "@/server/auth/session";
import { listTasks } from "@/server/tasks/service";

/**
 * The task list view (feature 003-task-management, T018; contracts/
 * routes-and-surfaces.md) — the signed-in user's tasks, newest-first.
 *
 * Server Component, ONE scoped query via the task service (`where { userId }`,
 * `orderBy createdAt desc`, UI fields only — `description` included for the
 * later edit surface); rows are mapped to `TaskDto` inside the service before
 * crossing to any client component (D4, constitution I). No client fetch, no
 * raw Prisma objects in props. Overdue is derived in the render layer with an
 * injected `today` (D1: one clock read per render, never inside components).
 */
export default async function TaskListView() {
  const session = await requireSession();
  // The (protected) layout guarantees a session; this narrows for the query.
  const tasks = session ? await listTasks(session.user.id) : [];
  const today = new Date();

  return (
    <CreateTaskSurfaceProvider>
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
        <TaskList tasks={tasks} today={today} />
      </main>
    </CreateTaskSurfaceProvider>
  );
}
