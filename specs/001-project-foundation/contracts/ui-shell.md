# Contract: UI Shell (F001)

The interface every future feature builds on (US4): theming, primitives, layout/responsive rules, and the placeholder page.

## Theme contract (FR-010)

- API: `ThemeProvider` in `src/components/theme/` wraps the root layout; `useTheme()` returns `{ theme, setTheme }`.
- Values: `light | dark | system`; default `system` on first visit; explicit choice persisted to `localStorage["focustodo-theme"]`.
- Behavior: switching applies immediately (no reload); a pre-hydration inline script sets the `<html>` class from storage or `prefers-color-scheme` so there is no wrong-theme flash; the choice survives a full browser restart (SC-004).
- Styling: Tailwind `dark:` variants keyed off the `<html>` class; design tokens defined once in `globals.css`.

## Primitives contract (FR-011)

- `src/components/ui/` holds the shadcn-convention primitives the scaffold needs (button, card, …), following the shadcn CLI conventions — accessible by default (semantic elements, keyboard operability, visible focus rings).
- `cn()` in `src/lib/utils.ts` is the single class-merging helper.
- Features MUST compose these primitives instead of restyling raw elements, keeping keyboard/focus behavior consistent app-wide.

## Layout & responsive contract (FR-015)

- One placeholder page (`src/app/page.tsx`) inside a semantic shell (header/main landmarks) rendering correctly at 320 / 768 / 1280 px with no horizontal scrolling (SC-006).
- Server Components by default; the theme toggle is F001's only client component (constitution III: minimal client JS).
- Content is placeholder text (English), explicitly not product copy (spec Assumptions).