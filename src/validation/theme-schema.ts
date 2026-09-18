import { z } from "zod";

/**
 * Theme preference contract (data-model.md / contracts/ui-shell.md).
 * Shared single source of truth: used by ThemeProvider and validated in
 * tests/unit/theme-schema.test.ts — the pattern every future input schema
 * must follow (constitution II).
 */
export const themeSchema = z.enum(["light", "dark", "system"]);

export type Theme = z.infer<typeof themeSchema>;

export const THEME_STORAGE_KEY = "focustodo-theme";
