import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { pitchHistoryCsv } from "@/lib/sales-intel-rules";
import { countsTowardScore } from "@/lib/top-performer.server";

const read = (p: string) => readFileSync(p, "utf8");

describe("security warning fixes", () => {
  it("pitch CSV neutralises formula-leading cells", () => {
    const csv = pitchHistoryCsv(
      { filters: {}, scope: "s", generatedAt: new Date("2026-10-01T00:00:00Z"), total: 1 },
      [{ id: "p1", created_at: "2026-10-01T00:00:00Z", lead_id: "L1", lead_name: "=HYPERLINK(1)", agent: null, objection_code: "x", template_id: null, action: "a", project: null, final_text: "@cmd", generated_text: null, fact_ids: [] }],
    );
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).toContain("'@cmd");
  });
  it("report sheet cells pass through safeCell", () => {
    expect(read("src/lib/report-sheet.server.ts")).toMatch(/\.map\(safeCell\)/);
  });
  it("AI history is never forwarded as real assistant turns", () => {
    expect(read("src/lib/copilot.server.ts")).not.toMatch(/role: m\.role/);
    expect(read("src/lib/command-agent.server.ts")).not.toMatch(/role: turn\.role/);
  });
  it("pitch cursor must be a real timestamp", () => {
    expect(read("src/lib/sales-intel.functions.ts")).toMatch(/datetime\(\{ offset: true \}\)/);
  });
  it("unverified new reports do not count toward the score; legacy ones do", () => {
    expect(countsTowardScore({ connection_verified: true, submitted_at: "2026-10-08T00:00:00Z" })).toBe(true);
    expect(countsTowardScore({ connection_verified: false, submitted_at: "2026-10-08T00:00:00Z" })).toBe(false);
    expect(countsTowardScore({ connection_verified: false, submitted_at: "2026-10-01T00:00:00Z" })).toBe(true);
  });
});
