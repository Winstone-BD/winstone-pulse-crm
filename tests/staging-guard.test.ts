import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("staging e2e suite safety", () => {
  const src = readFileSync("tests/staging/call-flow.staging.ts", "utf8");
  it("refuses the live project and needs explicit opt-in + ref confirmation", () => {
    expect(src).toMatch(/LIVE_REF = "siepfegeubbqwhodyxcg"/);
    expect(src).toMatch(/STAGING_E2E/);
    expect(src).toMatch(/STAGING_CONFIRM/);
    expect(src.indexOf("if (blocked) throw")).toBeLessThan(src.indexOf("beforeAll("));
  });
  it("is not part of the normal test run", () => {
    expect(readFileSync("vitest.config.ts", "utf8")).toMatch(/tests\/\*\*\/\*\.test\.ts/);
  });
});
