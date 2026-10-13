import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { defaultDueAt, dhakaPeriod, nextPeriod } from "@/lib/maintenance-rules";

const server = readFileSync("src/lib/maintenance.server.ts", "utf8");

describe("upcoming invoice reminder", () => {
  it("reminds only after the current period is verified", () => {
    const block = server.slice(server.indexOf("billing_upcoming_invoice") - 600);
    expect(block).toMatch(/row\.payment_status === "verified"/);
  });

  it("fires within 30 days before the next due date, never after it", () => {
    expect(server).toMatch(/msToDue > 0 && msToDue <= 30 \* 86_400_000/);
  });

  it("is deduped per billing period via notifyOnce", () => {
    expect(server).toMatch(/notifyOnce\(\s*`billing_upcoming_invoice_\$\{next\}`/);
  });

  it("uses the canonical next period and its due date (14th, Dhaka)", () => {
    expect(server).toMatch(/nextPeriod\(period\)/);
    expect(server).toMatch(/defaultDueAt\(next\)/);
    // 14 Oct 2026 Dhaka → current period 2026-10, next 2026-11 due 14 Nov 2026 00:00 Dhaka
    const now = new Date("2026-10-13T23:15:00Z");
    expect(dhakaPeriod(now)).toBe("2026-10");
    const next = nextPeriod("2026-10");
    expect(next).toBe("2026-11");
    expect(defaultDueAt(next)).toBe("2026-11-13T18:00:00.000Z"); // 14 Nov 00:00 Asia/Dhaka
  });

  it("never writes invoice or payment state — reminder is a deduped alert only", () => {
    const start = server.indexOf("billing_upcoming_invoice");
    const block = server.slice(start - 800, start + 700);
    expect(block).not.toMatch(/\.insert\(\{[^}]*system_maintenance|\.update\(|ensureRow\(next\)/);
  });
});
