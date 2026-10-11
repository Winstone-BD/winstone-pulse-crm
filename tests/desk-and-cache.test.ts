import { describe, expect, it } from "vitest";

import { pickNextLead } from "@/components/crm/desk/TodayHero";
import { contentHash } from "@/lib/summary-cache.server";

const lead = (o: Record<string, unknown>) => ({ id: String(Math.random()), work_state: "assigned", status: "pending", temperature: null, last_call_at: null, updated_at: "2026-10-01", ...o }) as never;

describe("next call", () => {
  it("prefers hot, skips completed and closed", () => {
    const n = pickNextLead([lead({ name: "c", temperature: "cold" }), lead({ name: "done", temperature: "hot", work_state: "completed" }), lead({ name: "h", temperature: "hot" }), lead({ name: "x", temperature: "hot", status: "closed" })]);
    expect((n as { name: string }).name).toBe("h");
  });
  it("returns null when nothing is open", () => {
    expect(pickNextLead([lead({ work_state: "completed" })])).toBeNull();
  });
});

describe("summary cache key", () => {
  it("is stable for identical content and differs otherwise", async () => {
    expect(await contentHash("a", "b")).toBe(await contentHash("a", "b"));
    expect(await contentHash("a", "b")).not.toBe(await contentHash("ab"));
  });
});
