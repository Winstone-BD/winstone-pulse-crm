import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAINTENANCE_CURRENCY, MAINTENANCE_FEE_MINOR, RENEWAL_DAY, futureInvoicePreview, moneyLabel, usd } from "@/lib/maintenance-rules";

describe("future maintenance invoices", () => {
  it("November 2026 preview is $35.29 USD due the 14th 00:00 Dhaka, lock 15th", () => {
    const p = futureInvoicePreview("2026-11");
    expect(p).toEqual({
      period: "2026-11", amountMinor: 3529, currency: "USD", amountLabel: "$35.29 USD",
      dueAt: "2026-11-13T18:00:00.000Z", lockAt: "2026-11-14T18:00:00.000Z",
    });
    expect(RENEWAL_DAY).toBe(14);
  });
  it("every future month uses the same fee and the 14th", () => {
    for (const period of ["2026-12", "2027-01", "2027-02"]) {
      const p = futureInvoicePreview(period);
      expect(p.amountMinor).toBe(MAINTENANCE_FEE_MINOR);
      expect(p.currency).toBe(MAINTENANCE_CURRENCY);
      expect(p.dueAt).toBe(`${period}-13T18:00:00.000Z`);
    }
  });
  it("preview is pure — the panel never writes", () => {
    const src = readFileSync("src/components/crm/MaintenancePanel.tsx", "utf8");
    const start = src.indexOf("function NextInvoicePreview");
    const fn = src.slice(start, src.indexOf("\n}\n", start));
    expect(fn).not.toMatch(/useMutation|mutate|insert|upsert|update\(/);
    expect(fn).toMatch(/Preview only · not an issued invoice/);
  });
});

describe("historical and unrelated USD stay unchanged", () => {
  it("historical 2026-10 snapshot still renders $18.16 USD", () => {
    expect(moneyLabel(1816, "USD")).toBe("$18.16 USD");
  });
  it("a stored BDT row still renders in BDT", () => {
    expect(moneyLabel(434500, "BDT")).toBe("৳4,345 BDT");
  });
  it("generic usd() formatter for bookings/sales is unchanged", () => {
    expect(usd(123456)).toBe("$1234.56");
  });
  it("invoice creation never overwrites an existing period", () => {
    expect(readFileSync("src/lib/maintenance.server.ts", "utf8")).toMatch(/ignoreDuplicates: true/);
  });
});
