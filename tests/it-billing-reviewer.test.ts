import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("IT Head-only service billing", () => {
  const source = readFileSync("src/lib/service-billing.functions.ts", "utf8");
  it("requires an authenticated user-bound IT token and the existing architect identity", () => {
    expect(source).toContain("if (!userId || !adminToken) return false");
    expect(source).toContain("itAccountTokenUser(adminToken) !== userId");
    expect(source).toContain("architectFromRequest()");
    expect(source).toContain("identity?.userId === userId");
    expect(source).toContain("await billingReviewer(caller.userId, adminToken)");
  });
  it("uses the same reviewer guard for verification and payout", () => {
    for (const name of ["verifyServiceInvoice", "recordServicePayout"]) {
      const block = source.slice(source.indexOf(`export const ${name}`));
      expect(block).toContain("await writer(data.adminToken)");
    }
  });
  it("hides financial actions unless the server grants the capability", () => {
    expect(readFileSync("src/components/crm/ServiceBillPanel.tsx", "utf8")).toContain('mode === "it" && query.data?.canApproveBilling && current');
  });
});