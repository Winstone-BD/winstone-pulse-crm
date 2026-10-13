import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync("src/routes/index.tsx", "utf8");

describe("homepage reference layout preserves safe entry", () => {
  it("stacks device choices on phones and retains three desktop choices", () => {
    expect(home).toMatch(/id="device-selection"[^>]*grid-cols-1[^>]*md:grid-cols-3/);
    expect(home).toContain("aria-pressed={selected}");
  });
  it("keeps optional device selection and ordered access behind Get started", () => {
    expect(home).toContain("setAccessOpen(true)");
    expect(home).toContain("{accessOpen &&");
    expect(home).toContain("selectedMode === null");
    const titles = ["Executive HQ", "Sales Agent", "LeadHub Nexus", "IT Console"];
    const positions = titles.map((title) => home.indexOf(`title="${title}"`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
  it("reports server health, not invented sales or sync metrics", () => {
    expect(home).toContain('fetch("/api/public/health"');
    expect(home).toContain('en: "Server online"');
    expect(home).not.toMatch(/All Systems Operational|Systems online|Updated in real time|Sales Progress/);
    expect(home).toContain("<MaintenanceFloorNotice");
  });
});