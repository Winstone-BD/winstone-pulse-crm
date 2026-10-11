import { describe, expect, it } from "vitest";

import { auditAgeDays, countResults, filterItems, resultKind, resultOptions } from "@/lib/audit-report-view";
import { AUDIT_ITEMS } from "@/lib/handover-docs";

describe("audit report view", () => {
  it("counts match the canonical audit items exactly", () => {
    const c = countResults(AUDIT_ITEMS);
    expect(c.total).toBe(AUDIT_ITEMS.length);
    expect(c.pass + c.qualified + c.other).toBe(AUDIT_ITEMS.length);
    expect(c.pass).toBe(AUDIT_ITEMS.filter((i) => i.result === "PASS").length);
  });
  it("filter options come only from results that exist", () => {
    for (const o of resultOptions(AUDIT_ITEMS)) expect(AUDIT_ITEMS.some((i) => i.result === o)).toBe(true);
  });
  it("qualified PASS is never treated as full PASS", () => {
    expect(resultKind("PASS (code/test)")).toBe("qualified");
    expect(resultKind("PASS")).toBe("pass");
  });
  it("search covers item and evidence text", () => {
    expect(filterItems(AUDIT_ITEMS, "enforce_contact_close_reason", "").length).toBe(1);
    expect(filterItems(AUDIT_ITEMS, "zzz-no-match", "")).toHaveLength(0);
  });
  it("audit age is computed from the documented UTC date", () => {
    expect(auditAgeDays("2026-09-30 13:40 UTC (x)", new Date("2026-10-11T13:40:00Z"))).toBe(11);
  });
});
