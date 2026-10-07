import { describe, it, expect } from "vitest";
import pkg from "../package.json";
// 2.26.0 emits createRequire(import.meta.url), which crashes every page on the live Worker.
describe("build tool pin", () => {
  it("keeps @lovable.dev/vite-tanstack-config at 2.25.2", () => {
    expect((pkg as any).devDependencies?.["@lovable.dev/vite-tanstack-config"] ?? (pkg as any).dependencies?.["@lovable.dev/vite-tanstack-config"]).toBe("2.25.2");
  });
});
