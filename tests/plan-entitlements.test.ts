import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("src/lib/maintenance.server.ts", "utf8");

describe("independent CRM / OS entitlements", () => {
  it("every billing-period read or write is scoped to this app's plan", () => {
    const unscoped = src.match(/(?<!PLAN_CODE\))\.eq\("billing_period"/g) ?? [];
    expect(unscoped).toHaveLength(0);
    expect(src).toContain('const PLAN_CODE = "crm"');
  });
  it("new invoices and unlock requests carry the plan", () => {
    expect((src.match(/plan_code: PLAN_CODE/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(src).toContain('onConflict: "billing_period,plan_code"');
  });
  it("the architect cannot decide another plan's unlock request from the CRM", () => {
    expect(src).toContain("request.plan_code !== PLAN_CODE");
  });
  it("database keeps one invoice per period per plan", () => {
    const m = readFileSync("drizzle/migrations/0107_independent_plan_entitlements.sql", "utf8");
    expect(m).toContain("(billing_period, plan_code)");
    expect(m).toContain("plan_code is immutable");
  });
});
