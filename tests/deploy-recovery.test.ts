import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { deployRecoveryScript } from "../src/lib/deploy-recovery";

const source = readFileSync("src/lib/deploy-recovery.ts", "utf8");

/**
 * Guards the exact failure the preview reported ("Module load recovery:
 * fallback-shown — TypeError: Importing a module script failed."): the tab
 * reloaded as soon as the document answered, while the module that had failed
 * was still missing, so it spent its attempts in seconds and showed a blank
 * screen. The bootstrap must wait for the module itself, and only fall back
 * once waiting has genuinely run out.
 */
describe("deployment recovery bootstrap", () => {
  it("is valid JavaScript", () => {
    new Function(deployRecoveryScript);
  });

  it("reloads only after the failing module serves again, not just the page", () => {
    expect(deployRecoveryScript).toContain("function probeModule");
    expect(deployRecoveryScript).toMatch(
      /Promise\.all\(\[probeDocument\(\),probeModule\(failingUrl\)\]\)/,
    );
  });

  it("remembers which module failed to load", () => {
    expect(deployRecoveryScript).toMatch(/failingUrl=t\.src/);
    expect(deployRecoveryScript).toMatch(/failingUrl=u/);
  });

  it("keeps every availability probe bounded", () => {
    expect(deployRecoveryScript).toMatch(/setTimeout\(function\(\)\{controller\.abort\(\)\},4000\)/);
  });

  it("is patient before showing the manual refresh screen", () => {
    const reloads = Number(source.match(/var MAX_RELOADS=(\d+)/)?.[1]);
    const probes = Number(source.match(/var PROBE_TRIES=(\d+)/)?.[1]);
    expect(reloads).toBeGreaterThanOrEqual(4);
    expect(probes).toBeGreaterThanOrEqual(10);
  });

  it("stays safe to inject inside a template literal", () => {
    expect(deployRecoveryScript).not.toContain("${");
    expect(deployRecoveryScript).not.toContain("`");
    expect(deployRecoveryScript.toLowerCase()).not.toContain("</script");
  });

  it("is injected by the root route", () => {
    expect(readFileSync("src/routes/__root.tsx", "utf8")).toContain("deployRecoveryScript");
  });
});
