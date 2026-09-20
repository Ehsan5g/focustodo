"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Protected navigation (feature 004-task-categories, T014; contracts/
 * routes-and-surfaces.md) — the primary nav links the tasks list and the
 * Categories management page. Works as a compact inline header nav at every
 * width (constitution V): two text links, wrapping never needed. The active
 * route gets `aria-current="page"` plus a visual distinction, so screen
 * readers announce the current page (FR-014) and sighted users see where
 * they are — everything routes through Link (no manual push).
 */
const LINKS: { href: string; label: string }[] = [
  { href: "/", label: "My tasks" },
  { href: "/categories", label: "Categories" },
];

export function ProtectedNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      data-testid="protected-nav"
      className="flex items-center gap-1"
    >
      {LINKS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
