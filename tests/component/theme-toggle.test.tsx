import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  window.localStorage.removeItem("focustodo-theme");
  document.documentElement.className = "";
});

/**
 * Component test (T021): proves the component layer of the harness on the
 * theme toggle — accessible name and keyboard operability (FR-005).
 */
it("renders with an accessible name exposing the current theme", () => {
  renderToggle();
  const toggle = screen.getByRole("button", {
    name: "Theme: system (click to change)",
  });
  expect(toggle).toBeInTheDocument();
  expect(toggle).toHaveTextContent("Theme: system");
});

it("is keyboard operable and cycles system → light → dark", async () => {
  const user = userEvent.setup();
  renderToggle();
  const toggle = screen.getByRole("button");
  await user.tab();
  expect(toggle).toHaveFocus();

  await user.keyboard("{Enter}"); // system → light
  expect(
    screen.getByRole("button", { name: "Theme: light (click to change)" }),
  ).toBeInTheDocument();

  await user.keyboard(" "); // light → dark
  expect(
    screen.getByRole("button", { name: "Theme: dark (click to change)" }),
  ).toBeInTheDocument();

  await user.click(toggle); // dark → system
  expect(
    screen.getByRole("button", { name: "Theme: system (click to change)" }),
  ).toBeInTheDocument();
});
