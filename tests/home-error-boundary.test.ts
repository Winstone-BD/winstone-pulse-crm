import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isStaleCodeError, shouldAutoReload } from "../src/components/HomeErrorBoundary";

describe("homepage error boundary", () => {
  it("is wired to the homepage", () => {
    expect(readFileSync("src/routes/index.tsx", "utf8")).toContain("errorComponent: HomeErrorBoundary");
  });
  it("detects stale page code", () => {
    expect(isStaleCodeError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isStaleCodeError(new Error("Invalid hook call"))).toBe(true);
    expect(isStaleCodeError(new Error("x is undefined"))).toBe(false);
  });
  it("never loops reloads", () => {
    expect(shouldAutoReload(100_000, null)).toBe(true);
    expect(shouldAutoReload(100_000, 90_000)).toBe(false);
    expect(shouldAutoReload(200_000, 90_000)).toBe(true);
  });
});
