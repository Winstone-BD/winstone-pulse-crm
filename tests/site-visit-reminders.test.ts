import { describe, expect, it } from "vitest";

import { canMoveVisit, visitReminderKey, visitReminderStage } from "@/lib/site-visit-rules";
import { OUTREACH_TEMPLATES, smsComposeUrl } from "@/components/crm/OutreachTemplates";
import { whatsAppDeepLink } from "@/lib/whatsapp";

const H = 3_600_000;
// 14 Oct 2026 10:00 Dhaka = 04:00 UTC
const now = Date.parse("2026-10-14T04:00:00Z");
const at = (h: number) => new Date(now + h * H).toISOString();

describe("site visit reminder stages", () => {
  it("24h window, 2h window, nothing beyond 24h", () => {
    expect(visitReminderStage({ status: "scheduled", visit_at: at(25) }, now)).toBeNull();
    expect(visitReminderStage({ status: "scheduled", visit_at: at(23) }, now)).toBe("24h");
    expect(visitReminderStage({ status: "confirmed", visit_at: at(2) }, now)).toBe("2h");
    expect(visitReminderStage({ status: "confirmed", visit_at: at(0.5) }, now)).toBe("2h");
    expect(visitReminderStage({ status: "confirmed", visit_at: at(-1) }, now)).toBe("late");
  });
  it("cancelled / no-show / offer made never remind; completed asks for outcome once", () => {
    for (const s of ["cancelled", "no_show", "offer_made"]) expect(visitReminderStage({ status: s, visit_at: at(1) }, now)).toBeNull();
    expect(visitReminderStage({ status: "completed", visit_at: at(-3) }, now)).toBe("outcome");
    expect(visitReminderStage({ status: "completed", visit_at: at(-3), outcome_at: at(-1) }, now)).toBeNull();
  });
  it("keys are idempotent per stage+time+recipient and change on reschedule", () => {
    const v = { id: "v1", visit_at: at(20) };
    expect(visitReminderKey(v, "24h", "a", now)).toBe(visitReminderKey(v, "24h", "a", now + H));
    expect(visitReminderKey(v, "24h", "a", now)).not.toBe(visitReminderKey(v, "2h", "a", now));
    expect(visitReminderKey(v, "24h", "a", now)).not.toBe(visitReminderKey(v, "24h", "coord", now));
    expect(visitReminderKey(v, "24h", "a", now)).not.toBe(visitReminderKey({ id: "v1", visit_at: at(30) }, "24h", "a", now));
    // timezone-safe: same instant written with a Dhaka offset gives the same key
    const dhaka = { id: "v1", visit_at: "2026-10-15T06:00:00+06:00" };
    expect(visitReminderKey(dhaka, "24h", "a", now)).toBe(visitReminderKey({ id: "v1", visit_at: "2026-10-15T00:00:00Z" }, "24h", "a", now));
  });
});

describe("site visit status transitions", () => {
  it("allows the pipeline forward path", () => {
    expect(canMoveVisit("scheduled", "confirmed")).toBe(true);
    expect(canMoveVisit("confirmed", "completed")).toBe(true);
    expect(canMoveVisit("completed", "offer_made")).toBe(true);
  });
  it("refuses backwards moves and reopening closed visits", () => {
    expect(canMoveVisit("completed", "scheduled")).toBe(false);
    expect(canMoveVisit("offer_made", "completed")).toBe(false);
    expect(canMoveVisit("cancelled", "confirmed")).toBe(false);
    expect(canMoveVisit("scheduled", "offer_made")).toBe(false);
  });
});

describe("outreach templates", () => {
  const ctx = { name: "রহিম & Co?", project: "Winstone Dream Park", agentName: "Haidar" };
  it("fill real lead fields only", () => {
    for (const t of OUTREACH_TEMPLATES) {
      const text = t.build(ctx);
      expect(text).toContain("রহিম & Co?");
      expect(text).not.toMatch(/৳|\d{4,}/); // no invented prices
    }
    expect(OUTREACH_TEMPLATES[0]!.build(ctx)).toContain("Winstone Dream Park");
    expect(OUTREACH_TEMPLATES[0]!.build({ name: "X" })).toContain("আমাদের প্রজেক্টের");
  });
  it("SMS and WhatsApp links are compose-only and fully encoded", () => {
    const text = OUTREACH_TEMPLATES[0]!.build(ctx);
    const sms = smsComposeUrl("01712-345678", text)!;
    expect(sms.startsWith("sms:+8801712345678?body=")).toBe(true);
    expect(decodeURIComponent(sms.split("body=")[1]!)).toBe(text);
    expect(sms).not.toMatch(/[ &]/);
    const wa = whatsAppDeepLink("8801712345678", text);
    expect(wa.startsWith("https://wa.me/8801712345678?text=")).toBe(true);
    expect(decodeURIComponent(wa.split("text=")[1]!)).toBe(text);
    expect(smsComposeUrl("123", text)).toBeNull();
  });
});
