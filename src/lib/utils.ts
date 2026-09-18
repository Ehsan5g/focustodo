import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** The single class-merging helper for UI primitives (contracts/ui-shell.md). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
