import { describe, expect, it } from "vitest";

import {
  canReschedule,
  dhakaDay,
  dhakaShift,
  followUpState,
  groupLeads,
  inBucket,
  matchesSearch,
  plausibleSeconds,
  type DeskLead,
} from "@/lib/lead-groups";

const NOW = Date.parse("2026-09-28T06:00:00Z"); // 12:00 Dhaka

const lead = (over: Partial<DeskLead> = {}): DeskLead => ({
  id: "a",
  name: "Karim",
  phone_number: "8801711000000",
  status: "pending",
  temperature: null,
  reference_by: "Rahim Bhai",
  company: "ACME",
  source: "facebook",
  call_attempts: 0,
  last_call_at: null,
  created_at: "2026-09-27T20:00:00Z", // 28 Sep 02:00 Dhaka
  ...over,
});

describe("Dhaka time", () => {
  it("day boundary uses UTC+6", () => {
    expect(dhakaDay("2026-09-27T18:30:00Z")).toBe("2026-09-28");
    expect(dhakaDay("2026-09-27T17:59:00Z")).toBe("2026-09-27");
  });
  it("shift split at 14:00 Dhaka", () => {
    expect(dhakaShift("2026-09-28T07:59:00Z")).toBe("morning");
    expect(dhakaShift("2026-09-28T08:00:00Z")).toBe("afternoon");
  });
});

describe("follow-up state", () => {
  it("classifies overdue / today / upcoming / none", () => {
    expect(followUpState("2026-09-28T05:00:00Z", NOW)).toBe("overdue");
    expect(followUpState("2026-09-28T10:00:00Z", NOW)).toBe("due_today");
    expect(followUpState("2026-09-29T10:00:00Z", NOW)).toBe("upcoming");
    expect(followUpState(null, NOW)).toBe("none");
  });
});

describe("desk buckets", () => {
  it("uncalled vs retry are exclusive", () => {
    const fresh = lead();
    const retried = lead({ call_attempts: 1, last_call_at: "2026-09-28T04:00:00Z" });
    expect(inBucket(fresh, undefined, "uncalled", NOW)).toBe(true);
    expect(inBucket(fresh, undefined, "retry", NOW)).toBe(false);
    expect(inBucket(retried, undefined, "retry", NOW)).toBe(true);
    expect(inBucket(retried, undefined, "uncalled", NOW)).toBe(false);
  });
  it("overdue needs a past follow-up", () => {
    const extras = { requirement: null, nextFollowUpAt: "2026-09-28T01:00:00Z" };
    expect(inBucket(lead(), extras, "overdue", NOW)).toBe(true);
    expect(inBucket(lead(), extras, "follow_up", NOW)).toBe(true);
    expect(inBucket(lead(), undefined, "overdue", NOW)).toBe(false);
  });
  it("today uses Dhaka day", () => {
    expect(inBucket(lead(), undefined, "today", NOW)).toBe(true);
  });
  it("combines bucket AND search", () => {
    const rows = [lead(), lead({ id: "b", name: "Salma", temperature: "hot", reference_by: null })];
    const hotSalma = rows.filter((l) => inBucket(l, undefined, "hot", NOW) && matchesSearch(l, "sal"));
    expect(hotSalma.map((l) => l.id)).toEqual(["b"]);
    expect(rows.filter((l) => matchesSearch(l, "rahim")).map((l) => l.id)).toEqual(["a"]);
    expect(rows.filter((l) => matchesSearch(l, "acme")).length).toBe(2);
  });
});

describe("grouping", () => {
  it("groups and counts, missing reference labelled", () => {
    const rows = [lead(), lead({ id: "b", reference_by: null }), lead({ id: "c" })];
    const groups = groupLeads(rows, new Map(), "reference", NOW);
    expect(groups[0]).toMatchObject({ key: "Rahim Bhai" });
    expect(groups[0]!.items.length).toBe(2);
    expect(groups[1]).toMatchObject({ key: "রেফারেন্স নেই" });
    expect(groups.reduce((s, g) => s + g.items.length, 0)).toBe(3);
  });
  it("date groups newest first", () => {
    const rows = [lead({ id: "x", created_at: "2026-09-01T00:00:00Z" }), lead()];
    expect(groupLeads(rows, new Map(), "date", NOW).map((g) => g.key)).toEqual([
      "2026-09-28",
      "2026-09-01",
    ]);
  });
});

describe("reschedule permission (IDOR)", () => {
  it("agent only moves own follow-ups", () => {
    const agent = { scope: "agent" as const, profileId: "me", readOnly: false };
    expect(canReschedule(agent, "me")).toBe(true);
    expect(canReschedule(agent, "other")).toBe(false);
    expect(canReschedule(agent, null)).toBe(false);
  });
  it("coordinator/HQ may, read-only and anonymous may not", () => {
    expect(canReschedule({ scope: "coordinator", profileId: "c", readOnly: false }, "x")).toBe(true);
    expect(canReschedule({ scope: "authority", profileId: null, readOnly: true }, "x")).toBe(false);
    expect(canReschedule({ scope: "none", profileId: null, readOnly: false }, "x")).toBe(false);
  });
});

describe("talk-time sanity", () => {
  it("drops impossible durations", () => {
    expect(plausibleSeconds(120)).toBe(120);
    expect(plausibleSeconds(-5)).toBe(0);
    expect(plausibleSeconds(99_999)).toBe(0);
    expect(plausibleSeconds(Number.NaN)).toBe(0);
    expect(plausibleSeconds(null)).toBe(0);
  });
});
