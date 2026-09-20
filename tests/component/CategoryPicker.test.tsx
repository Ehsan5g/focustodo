import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { CategoryPicker } from "@/features/categories/CategoryPicker";
import type { CategoryDto } from "@/server/categories/service";

/**
 * Component tests (F004 T016, FR-005/FR-006/FR-007): the picker renders a
 * single-select with "No category" first (value ""), lists the categories it
 * was given in the order the server sent them (alphabetical by nameKey —
 * the SERVICE owns ordering, the picker only renders), prefills the edit
 * surface's current assignment, and degrades to an empty state with the
 * next action when the user has no categories yet (FR-006/D5: creation is
 * never forced).
 */

const categories: CategoryDto[] = [
  { id: "cat-1", name: "Errands" },
  { id: "cat-2", name: "Work" },
];

it("renders a labeled single-select with No category first, then the categories", () => {
  render(<CategoryPicker categories={categories} />);
  const select = screen.getByLabelText("Category");
  expect(select.tagName).toBe("SELECT");
  const options = Array.from(select.querySelectorAll("option"));
  expect(options.map((option) => option.textContent)).toEqual([
    "No category",
    "Errands",
    "Work",
  ]);
  // Default selection: no category.
  expect(select).toHaveValue("");
});

it("carries the categoryId in the name so it round-trips through FormData", () => {
  render(<CategoryPicker categories={categories} />);
  expect(screen.getByLabelText("Category")).toHaveAttribute(
    "name",
    "categoryId",
  );
});

it("prefills the current assignment for the edit surface (FR-008)", () => {
  render(<CategoryPicker categories={categories} initialCategoryId="cat-2" />);
  expect(screen.getByLabelText("Category")).toHaveValue("cat-2");
});

it("switching the selection changes the submitted value", async () => {
  const user = userEvent.setup();
  render(<CategoryPicker categories={categories} />);
  const select = screen.getByLabelText("Category");
  await user.selectOptions(select, "cat-1");
  expect(select).toHaveValue("cat-1");
  await user.selectOptions(select, "");
  expect(select).toHaveValue("");
});

it("renders the empty state with a next action when there are no categories (FR-006)", () => {
  render(<CategoryPicker categories={[]} />);
  expect(screen.getByTestId("category-picker-empty")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Create a category" }),
  ).toHaveAttribute("href", "/categories");
});
