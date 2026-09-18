import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme/theme-toggle";

/**
 * Protected application shell (F002 T028): the F001 placeholder content
 * becomes the protected area's home page (spec Assumptions). Tasks will
 * appear in upcoming features; the route is served from the `(protected)`
 * group whose layout carries the authenticated header.
 */
export default function ProtectedHome() {
  return (
    <main
      id="main-content"
      className="relative flex flex-1 flex-col items-center justify-center gap-6 p-6"
    >
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>FocusTodo</CardTitle>
          <CardDescription>
            Foundation is running. Tasks will appear in upcoming features.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button>Add a task</Button>
          <Button variant="outline">View completed</Button>
          <Button variant="ghost" size="icon" aria-label="Settings">
            ⚙
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
