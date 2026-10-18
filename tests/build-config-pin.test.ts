import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

const PKG = "@lovable.dev/vite-tanstack-config";

describe("build tool pin", () => {
  // The platform may rewrite the declared devDependency; overrides and
  // resolutions are what force the installed version.
  it("forces @lovable.dev/vite-tanstack-config to 2.25.2 via overrides", () => {
    expect((pkg as any).overrides?.[PKG]).toBe("2.25.2");
  });
  it("forces @lovable.dev/vite-tanstack-config to 2.25.2 via resolutions", () => {
    expect((pkg as any).resolutions?.[PKG]).toBe("2.25.2");
  });
});
