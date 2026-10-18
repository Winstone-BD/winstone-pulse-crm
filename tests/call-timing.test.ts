import { describe, expect, it } from "vitest";
import { reconcileCallTiming } from "@/lib/call-timing";

const nowMs = Date.parse("2026-10-18T08:00:00Z");
const started = { call_status: "initiated", created_at: new Date(nowMs - 2000).toISOString(), duration_seconds: 0, device_reported_duration_seconds: null };
describe("offline call timing", () => {
  it("retains a 600-second offline claim while leaving the server cap intact", () => {
    const result = reconcileCallTiming({ state: "completed", claimedSeconds: 600, existing: started, nowMs });
    expect(result.reportedSeconds).toBe(600);
    expect(result.durationSeconds).toBe(62);
  });
  it("completion-first preserves 600 reported seconds with zero trusted credit", () => {
    const result = reconcileCallTiming({ state: "completed", claimedSeconds: 600, nowMs });
    expect(result.reportedSeconds).toBe(600);
    expect(result.durationSeconds).toBe(0);
  });
  it("late start cannot erase terminal status or duration", () => {
    const result = reconcileCallTiming({ state: "initiated", claimedSeconds: 0, existing: { ...started, call_status: "completed", duration_seconds: 62, device_reported_duration_seconds: 600 }, nowMs });
    expect(result).toEqual({ state: "completed", durationSeconds: 62, reportedSeconds: 600, applyEventTime: false });
  });
  it("terminal retry cannot gain duration as server time advances", () => {
    const result = reconcileCallTiming({ state: "completed", claimedSeconds: 86400, existing: { ...started, call_status: "completed", duration_seconds: 62, device_reported_duration_seconds: 600 }, nowMs: nowMs + 86400000 });
    expect(result.durationSeconds).toBe(62);
    expect(result.reportedSeconds).toBe(600);
  });
  it("late ringing cannot downgrade an answered call", () => {
    expect(reconcileCallTiming({ state: "ringing", existing: { ...started, call_status: "answered" }, nowMs }).state).toBe("answered");
  });
});