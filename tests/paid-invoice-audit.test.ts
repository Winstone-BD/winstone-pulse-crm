import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { paidInvoiceAudit } from "@/lib/maintenance-rules";

describe("paid invoice audit", () => {
  const periods = [
    { billing_period: "2026-10", payment_status: "verified", payment_verified_by: "IT Console (owner instruction)", payment_verified_at: "2026-10-13T23:09:14Z" },
    { billing_period: "2026-08", payment_status: "verified", payment_verified_by: "arch@x.com", payment_verified_at: "2026-08-10T00:00:00Z" },
    { billing_period: "2026-11", payment_status: "pending", payment_verified_by: null, payment_verified_at: null },
  ];
  const audit = [{ billing_period: "2026-08", action: "payment_verified", actor: "arch@x.com", actor_role: "architect", at: "2026-08-10T00:00:00Z" }];
  it("flags skipped approval and lists only paid invoices", () => {
    const rows = paidInvoiceAudit(periods, audit);
    expect(rows.map((r) => r.period)).toEqual(["2026-10", "2026-08"]);
    expect(rows[0]).toMatchObject({ markedBy: "IT Console (owner instruction)", approvalSkipped: true });
    expect(rows[1]).toMatchObject({ markedBy: "arch@x.com", approvalSkipped: false });
  });
  it("database requires a pending reference and authorized approver before paid", () => {
    const dir = "drizzle/migrations";
    const sql = readdirSync(dir).filter((f) => f.includes("require_approval_before_paid")).map((f) => readFileSync(`${dir}/${f}`, "utf8")).join("");
    expect(sql).toMatch(/OLD\.payment_status IS DISTINCT FROM 'pending'/);
    expect(sql).toMatch(/owner instruction/);
  });
});
