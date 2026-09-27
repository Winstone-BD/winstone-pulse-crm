import { describe, expect, it } from "vitest";

import {
  assignmentState,
  followUpStatus,
  lifecycleStage,
  maskPhone,
  toGrade,
  toTemperature,
} from "@/lib/crm-taxonomy";

describe("canonical taxonomy", () => {
  it("separates Head Lead Store from agent queue", () => {
    expect(assignmentState({ assigned_to: null })).toBe("HEAD_STORE");
    expect(assignmentState({ assigned_to: "a" })).toBe("AGENT_QUEUE");
    expect(assignmentState({ assigned_to: null, assignment_source: "duplicate_skipped" })).toBe("PARKED");
  });

  it("derives one lifecycle stage", () => {
    expect(lifecycleStage({ assigned_to: null, status: "pending" })).toBe("UNASSIGNED");
    expect(lifecycleStage({ assigned_to: "a", status: "pending" })).toBe("ASSIGNED");
    expect(lifecycleStage({ assigned_to: "a", status: "contacted", grade: "A" })).toBe("QUALIFIED");
    expect(lifecycleStage({ assigned_to: "a", status: "contacted", grade: "D" })).toBe("CONTACTED");
    expect(lifecycleStage({ assigned_to: "a", status: "follow_up" })).toBe("FOLLOW_UP");
    expect(lifecycleStage({ assigned_to: "a", outcome_category: "Site Visit" })).toBe("SITE_VISIT");
    expect(lifecycleStage({ assignment_source: "duplicate_skipped" })).toBe("DUPLICATE");
  });

  it("classifies follow-up state", () => {
    const now = Date.parse("2026-09-28T06:00:00Z");
    expect(followUpStatus(null, now)).toBe("NONE");
    expect(followUpStatus({ scheduled_at: "2026-09-28T05:00:00Z", status: "upcoming" }, now)).toBe("OVERDUE");
    expect(followUpStatus({ scheduled_at: "2026-09-28T07:00:00Z", status: "upcoming" }, now)).toBe("DUE");
    expect(followUpStatus({ scheduled_at: "2026-09-28T05:00:00Z", status: "done" }, now)).toBe("COMPLETED");
  });

  it("normalises temperature, grade and masks phones", () => {
    expect(toTemperature(" hot ")).toBe("HOT");
    expect(toTemperature("lukewarm")).toBeNull();
    expect(toGrade("b+")).toBe("B");
    expect(maskPhone("01712345678")).toBe("017•••••678");
  });
});
