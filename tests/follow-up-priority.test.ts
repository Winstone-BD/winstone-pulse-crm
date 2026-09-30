import { describe, expect, it } from "vitest";

import { compareFollowUpPriority, followUpPriorityFor } from "@/lib/follow-up-priority";

describe("follow-up priority", () => {
  it("derives priority from saved Hot/Warm/Cold facts", () => {
    expect(followUpPriorityFor("hot")).toBe("high");
    expect(followUpPriorityFor("warm")).toBe("medium");
    expect(followUpPriorityFor("cold")).toBe("low");
    expect(followUpPriorityFor(null)).toBe("low");
  });

  it("puts overdue work ahead of future Hot work", () => {
    const now = Date.parse("2026-10-01T06:00:00Z");
    const overdue = { id: "a", scheduled_at: "2026-10-01T05:00:00Z", priority: "low" };
    const futureHot = { id: "b", scheduled_at: "2026-10-02T06:00:00Z", priority: "high" };
    expect(compareFollowUpPriority(overdue, futureHot, now)).toBeLessThan(0);
  });

  it("puts Hot before Warm before Cold inside the same time band", () => {
    const now = Date.parse("2026-10-01T06:00:00Z");
    const at = "2026-10-01T07:00:00Z";
    const hot = { id: "a", scheduled_at: at, priority: "high" };
    const warm = { id: "b", scheduled_at: at, priority: "medium" };
    const cold = { id: "c", scheduled_at: at, priority: "low" };
    expect([cold, warm, hot].sort((a, b) => compareFollowUpPriority(a, b, now)).map((row) => row.id)).toEqual(["a", "b", "c"]);
  });
});