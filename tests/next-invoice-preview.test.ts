import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MAINTENANCE_CURRENCY, MAINTENANCE_FEE_MINOR, billingStatusLine, invoiceTotals,
  nextInvoicePreviewFor, nextUngeneratedPeriod, parseVatSetting,
} from "@/lib/maintenance-rules";

describe("next invoice preview", () => {
  it("uses the canonical fee, currency and 14th 00:00 Dhaka due date", () => {
    const p = nextInvoicePreviewFor("2026-11", 1500);
    expect(p.subtotalMinor).toBe(MAINTENANCE_FEE_MINOR);
    expect(p.currency).toBe(MAINTENANCE_CURRENCY);
    expect(p.dueAt).toBe("2026-11-13T18:00:00.000Z");
  });
  it("VAT math is integer and transparent", () => {
    expect(invoiceTotals(3529, 1500)).toEqual({ subtotalMinor: 3529, vatRateBps: 1500, vatMinor: 529, totalMinor: 4058 });
    expect(invoiceTotals(434500, 1500)).toEqual({ subtotalMinor: 434500, vatRateBps: 1500, vatMinor: 65175, totalMinor: 499675 });
    expect(nextInvoicePreviewFor("2026-11", 1500).vatRateLabel).toBe("15.00%");
  });
  it("missing VAT config is shown, never assumed 0%", () => {
    const p = nextInvoicePreviewFor("2026-11", null);
    expect(p.vatRateLabel).toBe("VAT rate not configured");
    expect(p.vatMinor).toBeNull();
    expect(p.totalMinor).toBeNull();
    expect(parseVatSetting(null)).toBeNull();
    expect(parseVatSetting({ rate_bps: "15" })).toBeNull();
    expect(parseVatSetting({ rate_bps: 20000 })).toBeNull();
    expect(parseVatSetting({ rate_bps: 0 })).toBe(0);
  });
  it("rolls over to the next month / year in Asia/Dhaka", () => {
    expect(nextUngeneratedPeriod(new Date("2026-10-13T22:00:00Z"), true)).toBe("2026-11");
    expect(nextUngeneratedPeriod(new Date("2026-10-13T22:00:00Z"), false)).toBe("2026-10");
    expect(nextUngeneratedPeriod(new Date("2026-12-31T18:30:00Z"), true)).toBe("2027-02"); // already Jan 1 in Dhaka
    expect(nextInvoicePreviewFor("2027-01", null).dueAt).toBe("2027-01-13T18:00:00.000Z");
  });
  it("status line says complete only for verified + unlocked", () => {
    expect(billingStatusLine({ paymentStatus: "verified", locked: false, period: "2026-10" })).toBe("Billing complete / approved");
    expect(billingStatusLine({ paymentStatus: "pending", locked: false, period: "2026-10" })).not.toMatch(/complete/);
    expect(billingStatusLine({ paymentStatus: "unpaid", locked: true, period: "2026-10" })).toMatch(/locked/);
    expect(billingStatusLine(null)).toBe("Status unavailable");
  });
  it("server preview is IT-Console gated and read-only", () => {
    const fns = readFileSync("src/lib/maintenance.functions.ts", "utf8");
    const f = fns.slice(fns.indexOf("export const nextMaintenanceInvoicePreview"), fns.indexOf("/**", fns.indexOf("export const nextMaintenanceInvoicePreview")));
    expect(f).toMatch(/await itCaller\(data\.adminToken\)/);
    expect(f).not.toMatch(/architect|maintenanceAccess/);
    const srv = readFileSync("src/lib/maintenance.server.ts", "utf8");
    const s0 = srv.indexOf("export async function previewNextInvoice");
    const body = srv.slice(s0, srv.indexOf("\nasync function ensureRow", s0));
    expect(body).not.toMatch(/\.insert\(|\.upsert\(|\.update\(|\.delete\(|audit\(|ensureRow/);
  });
});
