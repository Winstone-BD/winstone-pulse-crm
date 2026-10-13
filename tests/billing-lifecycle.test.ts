import { describe, expect, it } from "vitest";
import {
  deadlineLeftLabel, dhakaClockLabel, dhakaDateLabel,
  isAmberWindow, isRedWindow, paymentDueLabel, subscriptionNoticeCopy, subscriptionNoticeState,
} from "@/lib/maintenance-rules";

// Dhaka = UTC+6. Helper builds a UTC instant from a Dhaka wall-clock time.
const dhaka = (y: number, m: number, d: number, hh = 0, mm = 0) => new Date(Date.UTC(y, m - 1, d, hh - 6, mm));

describe("billing windows (Asia/Dhaka)", () => {
  it("amber starts 9th 00:00 and ends 13th 23:59", () => {
    expect(isAmberWindow(dhaka(2026, 10, 8, 23, 59))).toBe(false);
    expect(isAmberWindow(dhaka(2026, 10, 9, 0, 0))).toBe(true);
    expect(isAmberWindow(dhaka(2026, 10, 13, 23, 59))).toBe(true);
    expect(isAmberWindow(dhaka(2026, 10, 14, 0, 0))).toBe(false);
  });
  it("red is the 14th due day only, never on the 15th", () => {
    expect(isRedWindow(dhaka(2026, 10, 13, 23, 59))).toBe(false);
    expect(isRedWindow(dhaka(2026, 10, 14, 0, 0))).toBe(true);
    expect(isRedWindow(dhaka(2026, 10, 14, 23, 59))).toBe(true);
    expect(isRedWindow(dhaka(2026, 10, 15, 0, 0))).toBe(false);
  });
  it("amber and red never overlap across a month", () => {
    for (let h = 0; h < 31 * 24; h++) {
      const t = dhaka(2026, 12, 1, h);
      expect(isAmberWindow(t) && isRedWindow(t)).toBe(false);
    }
  });
  it("uses Dhaka date, not UTC date, at the boundary", () => {
    expect(isAmberWindow(new Date(Date.UTC(2026, 9, 8, 18, 0)))).toBe(true);
  });
  it("month transition: Dec→Jan windows still work", () => {
    expect(isAmberWindow(dhaka(2027, 1, 9, 0, 0))).toBe(true);
    expect(isRedWindow(dhaka(2027, 1, 14, 10, 0))).toBe(true);
  });
});

describe("payment-status wording", () => {
  it("never says overdue on or before the 14th due day", () => {
    expect(paymentDueLabel(dhaka(2026, 10, 12, 18))).toBe("Payment Due");
    expect(paymentDueLabel(dhaka(2026, 10, 14, 23, 59))).toBe("Payment Due");
  });
});

describe("notice card copy", () => {
  const opts = { month: "October", totalLabel: "$35.29 USD", lockDate: "15 Oct 2026", lockClock: "00:00 (Asia/Dhaka)" };
  it("red states the deadline and offers one payment action", () => {
    const c = subscriptionNoticeCopy("red", opts);
    expect(c.tone).toBe("red");
    expect(c.cta).toBe("Review invoice & pay");
    expect(c.body.join(" ")).toContain("15 Oct 2026 00:00 (Asia/Dhaka)");
    expect(c.body.join(" ")).toContain("$35.29 USD");
  });
  it("amber keeps the same action but never claims suspension", () => {
    const c = subscriptionNoticeCopy("amber", opts);
    expect(c.title).toBe("Payment due soon");
    expect(c.cta).toBe("Review invoice & pay");
    expect(c.body.join(" ")).not.toContain("locked automatically");
  });
  it("blue asks for nothing", () => {
    const c = subscriptionNoticeCopy("blue", opts);
    expect(c.cta).toBeNull();
    expect(c.title).toBe("Payment verification in progress");
  });
});

describe("deadline chip", () => {
  it("counts days, then hours, then minutes", () => {
    expect(deadlineLeftLabel(6 * 86_400_000)).toBe("6 days left");
    expect(deadlineLeftLabel(86_400_000)).toBe("1 day left");
    expect(deadlineLeftLabel(86_400_000 + 1)).toBe("2 days left");
    expect(deadlineLeftLabel(3 * 3_600_000)).toBe("3 hours left");
    expect(deadlineLeftLabel(45 * 60_000)).toBe("45 minutes left");
    expect(deadlineLeftLabel(0)).toBe("Deadline passed");
  });
  it("shows the lock instant in Dhaka time", () => {
    const lock = new Date(Date.UTC(2026, 9, 14, 18, 0)).toISOString(); // 15 Oct 00:00 Dhaka
    expect(dhakaDateLabel(lock)).toBe("15 Oct 2026");
    expect(dhakaClockLabel(lock)).toBe("00:00 (Asia/Dhaka)");
  });
});

describe("one notice per billing state", () => {
  it("amber through the 13th, red on the 14th due day, blue once a receipt is in", () => {
    expect(subscriptionNoticeState("unpaid", false, dhaka(2026, 10, 9, 0, 0))).toBe("amber");
    expect(subscriptionNoticeState("unpaid", false, dhaka(2026, 10, 13, 23, 59))).toBe("amber");
    expect(subscriptionNoticeState("unpaid", false, dhaka(2026, 10, 14, 0, 0))).toBe("red");
    expect(subscriptionNoticeState("pending", false, dhaka(2026, 10, 13, 0, 0))).toBe("blue");
    expect(subscriptionNoticeState("verified", false, dhaka(2026, 10, 13, 0, 0))).toBeNull();
    expect(subscriptionNoticeState("unpaid", true, dhaka(2026, 10, 13, 0, 0))).toBeNull();
    expect(subscriptionNoticeState("unpaid", false, dhaka(2026, 10, 8, 12, 0))).toBeNull();
  });
});
