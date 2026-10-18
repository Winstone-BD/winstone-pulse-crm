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

describe("bulk extra leads idempotency + target lock", () => {
  it("requires a requestId and the previewed agent list", () => {
    expect(block).toMatch(/requestId: z\.string\(\)\.uuid\(\)/);
    expect(block).toMatch(/expectedAgentIds/);
    expect(block).toMatch(/Preview-এর পর বদলেছে/);
  });
  it("grantExtraLeads replays an existing request instead of granting again", () => {
    const server = readFileSync("src/lib/lead-pool.server.ts", "utf8");
    expect(server).toMatch(/\.eq\("request_id", input\.requestId\)/);
    expect(server).toMatch(/replayed: true/);
  });
});

describe("bulk extra history", () => {
  it("is gated by the LeadHub dispatcher", () => {
    const h = src.slice(src.indexOf("export const bulkExtraHistory"), src.indexOf("export const autoRefillMyLeads"));
    expect(h).toMatch(/await dispatcher\(data\.adminToken\)/);
  });
});

describe("bulk extra availability guard", () => {
  it("refuses the batch when eligible leads cannot cover agents × quantity", () => {
    expect(block).toMatch(/available < need/);
  });
});

import { readFileSync as __r } from "node:fs";
import { describe as __d, it as __i, expect as __e } from "vitest";
__d("bulk extra batch serialization", () => {
  const fn = __r("src/lib/lead-pool.functions.ts", "utf8");
  const srv = __r("src/lib/lead-pool.server.ts", "utf8");
  __i("claims the per-day lock before any grant", () => {
    __e(fn.indexOf("claimBulkBatch(data.requestId")).toBeGreaterThan(-1);
    __e(fn.indexOf("claimBulkBatch(data.requestId")).toBeLessThan(fn.indexOf("requestId: data.requestId,\n          });"));
  });
  __i("a different request on the same day is refused", () => {
    __e(srv).toMatch(/from\("bulk_extra_batches"\)\s*\.insert\(\{ work_date: today/);
    __e(srv).toContain("row.request_id === requestId && row.status === \"done\"");
  });
});
