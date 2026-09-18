"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme/theme-provider";
import type { Theme } from "@/validation/theme-schema";

const OPTIONS: Theme[] = ["light", "dark", "system"];

/**
 * Theme toggle (US2/T028, FR-010): cycles light → dark → system and
 * persists the choice via ThemeProvider. Hydration-safe: the store's server
 * snapshot is "system", so SSR and first client render agree.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const next = () => {
    const index = OPTIONS.indexOf(theme);
    setTheme(OPTIONS[(index + 1) % OPTIONS.length] ?? "system");
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={next}
      aria-label={`Theme: ${theme} (click to change)`}
    >
      Theme: {theme}
    </Button>
  );
}
