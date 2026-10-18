import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("src/lib/lead-pool.functions.ts", "utf8");
const block = src.slice(src.indexOf("const BulkExtraInput"), src.indexOf("export const autoRefillMyLeads"));

describe("bulk extra leads (IT Console)", () => {
  it("requires a reason of at least 5 characters", () => {
    expect(block).toMatch(/reason: z\.string\(\)\.trim\(\)\.min\(5\)/);
  });
  it("requires explicit over-quota acknowledgement", () => {
    expect(block).toMatch(/acknowledgeOverQuota: z\.literal\(true\)/);
  });
  it("is gated by the LeadHub dispatcher and audited per agent via grantExtraLeads", () => {
    expect(block).toMatch(/await dispatcher\(data\.adminToken\)/);
    expect(block).toMatch(/grantExtraLeads\(/);
    expect(block).toMatch(/assertDistributionDay\(\)/);
  });
});
