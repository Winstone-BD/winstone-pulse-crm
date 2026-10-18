import { describe, expect, it } from "vitest";
import { dhakaDayBounds, isPendingWork, workloadRow } from "../src/lib/agent-workload";

describe("agent workload", () => {
  it("old pending leads cannot hide the fresh gap to 50", () => {
    expect(workloadRow(17, 310, 5)).toEqual({ newLeads: 17, pending: 310, calls: 5, gap: 33, ok: false });
    expect(workloadRow(50, 400, 0).ok).toBe(true);
    expect(workloadRow(65, 400, 0)).toMatchObject({ gap: 0, ok: false });
  });
  it("excludes inactive pool states from active pending", () => {
    expect(isPendingWork("pending", "pending")).toBe(true);
    for (const state of ["completed", "unresponsive", "duplicate_skipped", "snoozed"]) expect(isPendingWork("pending", state)).toBe(false);
    expect(isPendingWork("follow_up", "pending")).toBe(false);
  });
  it("uses exclusive Dhaka midnight boundaries", () => {
    expect(dhakaDayBounds("2026-10-18")).toEqual({ start: "2026-10-17T18:00:00.000Z", end: "2026-10-18T18:00:00.000Z" });
    expect(() => dhakaDayBounds("2026-02-31")).toThrow("Invalid date");
  });
});