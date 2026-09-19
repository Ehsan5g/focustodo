import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { requireSession } from "@/server/auth/session";
import { listTasks } from "@/server/tasks/service";
import { NewTaskSurface } from "@/features/tasks/NewTaskSurface";

/**
 * Protected application shell (F002 T028; F003 T015 interim): the placeholder
 * shell gains the real "New task" control and the adaptive create surface.
 * The full task list view lands with US2 (T018/T019) — this interim state
 * already lets a signed-in user create tasks end-to-end (US1).
 */
export default async function ProtectedHome() {
  const session = await requireSession();
  // The (protected) layout guarantees a session; this narrows for the query.
  const tasks = session ? await listTasks(session.user.id) : [];

  return (
    <main
      id="main-content"
      className="relative flex flex-1 flex-col items-center justify-center gap-6 p-6"
    >
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="absolute top-4 left-4">
        <NewTaskSurface />
      </div>
      <Button>Add a task</Button>
      <p className="text-muted-foreground text-sm" suppressHydrationWarning>
        {tasks.length === 0
          ? "Foundation is running. Your tasks will appear here."
          : `${tasks.length} task${tasks.length === 1 ? "" : "s"} saved.`}
      </p>
    </main>
  );
}
