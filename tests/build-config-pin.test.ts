import { describe, expect, it } from "vitest";
import pkg from "../package.json";

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
