import { describe, expect, it } from "vitest";

import { decide, defaultDueAt, defaultLockAt, dhakaPeriod } from "@/lib/maintenance-rules";

/** Dhaka wall-clock → Date (Asia/Dhaka is fixed UTC+6, no DST). */
const dhaka = (local: string) => new Date(`${local}+06:00`);
const unpaid = (period: string) => ({
  lockAt: defaultLockAt(period),
  paymentStatus: "unpaid" as const,
  unlockStatus: "none" as const,
  unlockExpiresAt: null,
});

// Short, long, leap, non-leap and year-crossing months.
const periods = ["2026-02", "2026-04", "2026-10", "2026-12", "2027-01", "2028-02"];

describe.each(periods)("maintenance calendar %s (Asia/Dhaka)", (period) => {
  const at = (day: string, time: string) => dhaka(`${period}-${day}T${time}`);
  const stage = (day: string, time: string) => decide({ ...unpaid(period), now: at(day, time) });

  it("lock is the 15th 00:00 Dhaka (14th 18:00 UTC)", () => {
    expect(defaultLockAt(period)).toBe(`${period}-14T18:00:00.000Z`);
  });
  it("renewal due is the 12th 00:00 Dhaka (11th 18:00 UTC)", () => {
    expect(defaultDueAt(period)).toBe(`${period}-11T18:00:00.000Z`);
  });
  it("no notice on the 8th 23:59", () => {
    expect(stage("08", "23:59:59").stage).toBe("clear");
  });
  it("notice starts on the 9th 00:00", () => {
    expect(stage("09", "00:00:00").stage).toBe("upcoming");
  });
  it("still open on the 14th 23:59:59", () => {
    expect(stage("14", "23:59:59")).toEqual({ locked: false, stage: "due_today" });
  });
  it("locks exactly at the 15th 00:00", () => {
    expect(stage("15", "00:00:00")).toEqual({ locked: true, stage: "locked" });
  });
  it("paid month never locks, even late in the month", () => {
    expect(decide({ ...unpaid(period), paymentStatus: "verified", now: at("28", "12:00:00") }).locked).toBe(false);
  });
  it("billing period follows the Dhaka date, not UTC", () => {
    expect(dhakaPeriod(at("01", "00:30:00"))).toBe(period);
  });
});

describe("month/year edges", () => {
  it("Dhaka midnight on 1 Jan is already the new year's period", () => {
    expect(dhakaPeriod(new Date("2026-12-31T18:00:00Z"))).toBe("2027-01");
    expect(dhakaPeriod(new Date("2026-12-31T17:59:59Z"))).toBe("2026-12");
  });
  it("last-month lock does not carry into the new month's period", () => {
    // 1 Nov Dhaka: the November row starts fresh, lock is 15 Nov.
    const now = dhaka("2026-11-01T09:00:00");
    expect(dhakaPeriod(now)).toBe("2026-11");
    expect(decide({ ...unpaid("2026-11"), now }).stage).toBe("clear");
  });
});
