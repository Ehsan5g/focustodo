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
 * Placeholder page (US1/T021): proves the app shell + design system run â€”
 * replaced by future task features.
 */
export default function Home() {
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
            âš™
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
