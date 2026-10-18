import { describe, expect, it } from "vitest";
import { isModuleLoadError } from "../src/lib/module-load-error";

describe("caught route import recovery", () => {
  it("recognizes the reported home split-module failure", () => {
    expect(isModuleLoadError(new TypeError("Failed to fetch dynamically imported module: /src/routes/index.tsx?tsr-split=component"))).toBe(true);
  });
  it("recognizes Safari import failures and chunk failures", () => {
    expect(isModuleLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isModuleLoadError("ChunkLoadError: Loading chunk 6 failed")).toBe(true);
  });
  it("does not treat authorization or data errors as deployment failures", () => {
    expect(isModuleLoadError(new Error("Unauthorized"))).toBe(false);
    expect(isModuleLoadError(new Error("Report submission failed"))).toBe(false);
    expect(isModuleLoadError(null)).toBe(false);
  });
});