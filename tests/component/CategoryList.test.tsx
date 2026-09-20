import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { CategoryList } from "@/features/categories/CategoryList";
import type { CategoryDto } from "@/server/categories/service";

// The list imports the real server action module for its row surfaces —
// component tests replace that boundary (D12), never loading Prisma/session.
vi.mock("@/server/actions/category-actions", () => ({
  updateCategoryAction: vi.fn(),
}));

/**
 * Component tests (F004 T010, FR-005/FR-012): the list renders the DTOs in
 * the RECEIVED order — the service orders by `nameKey` asc (case-insensitive
 * alphabetical, FR-005), so mixed-case fixtures must not be re-sorted in the
 * UI; every name renders as readable text; the empty state offers a clear
 * create action (quickstart S12).
 */

const categories: CategoryDto[] = [
  { id: "cat-1", name: "apple pie" },
  { id: "cat-2", name: "Banana" },
  { id: "cat-3", name: "Cherry" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

it("renders the categories in the received (nameKey) order — no UI re-sort", () => {
  render(<CategoryList categories={categories} />);
  const items = screen.getAllByTestId("category-item");
  // The row also carries its per-row controls (rename T026 / delete T031);
  // the ORDER assertion reads the name element, not the row's whole text.
  expect(
    items.map(
      (item) =>
        item.querySelector("[data-testid='category-name']")?.textContent,
    ),
  ).toEqual(["apple pie", "Banana", "Cherry"]);
});

it("renders each category's name as readable text (never color alone)", () => {
  render(<CategoryList categories={categories} />);
  expect(screen.getByText("Banana")).toBeInTheDocument();
  expect(screen.getByText("apple pie")).toBeInTheDocument();
});

it("shows the empty state with a clear create action (FR-012, S12)", async () => {
  const onCreateClick = vi.fn();
  const user = userEvent.setup();
  render(<CategoryList categories={[]} onCreateClick={onCreateClick} />);
  expect(screen.getByTestId("category-empty-state")).toBeInTheDocument();
  await user.click(screen.getByTestId("empty-state-create-category"));
  expect(onCreateClick).toHaveBeenCalledTimes(1);
});
