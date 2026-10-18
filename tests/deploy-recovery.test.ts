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
  const start = deployRecoveryScript.indexOf("function urlFrom(m)");
  const end = deployRecoveryScript.indexOf("var F=window.fetch", start);
  const extract = new Function(`${deployRecoveryScript.slice(start, end)};return urlFrom;`)() as (message: string) => string | null;
  it.each([
    "https://preview.example/src/routes/system.tsx?tsr-split=component",
    "https://preview.example/src/routes/desk.tsx?tsr-split=component&t=123",
    "https://preview.example/assets/system-abc.js",
    "https://preview.example/assets/system-abc.mjs?version=1",
    "/src/routes/hq.tsx?tsr-split=component",
  ])("probes the full failed module URL %s", url => {
    expect(extract(`Failed to fetch dynamically imported module: ${url}`)).toBe(url);
  });
  it("does not invent a module URL for React hook errors", () => {
    expect(extract("Cannot read properties of null (reading 'use')")).toBeNull();
  });
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

  it("treats React stale-bundle null reads as recoverable", () => {
    // "Cannot read properties of null (reading 'use')" — a tab holding a mix of
    // old and new dependency bundles. It must trigger the same recovery reload.
    expect(deployRecoveryScript).toMatch(/Cannot read properties of \(\?:null\|undefined\)/);
  });
  it.each(["use", "useContext", "useState", "useSyncExternalStore"])("recognizes the actual parenthesized React %s crash", hook => {
    const start = deployRecoveryScript.indexOf("function bad(m)");
    const end = deployRecoveryScript.indexOf("function urlFrom(m)", start);
    const isRecoverable = new Function(`${deployRecoveryScript.slice(start, end)};return bad;`)() as (message: string) => boolean;
    expect(isRecoverable(`Uncaught TypeError: Cannot read properties of null (reading '${hook}')`)).toBe(true);
    expect(isRecoverable("Cannot read properties of null (reading 'customer')")).toBe(false);
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
