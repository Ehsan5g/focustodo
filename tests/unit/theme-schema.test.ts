import { describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY, themeSchema } from "@/validation/theme-schema";

describe("themeSchema (shared-schema pattern, constitution II)", () => {
  it("accepts every valid theme value", () => {
    expect(themeSchema.parse("light")).toBe("light");
    expect(themeSchema.parse("dark")).toBe("dark");
    expect(themeSchema.parse("system")).toBe("system");
  });

  it("rejects invalid values with an issue path", () => {
    const result = themeSchema.safeParse("blue");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual([]);
    }
  });

  it("rejects non-string input", () => {
    expect(themeSchema.safeParse(1).success).toBe(false);
    expect(themeSchema.safeParse(null).success).toBe(false);
  });

  it("exposes the contractual localStorage key", () => {
    expect(THEME_STORAGE_KEY).toBe("focustodo-theme");
  });
});
