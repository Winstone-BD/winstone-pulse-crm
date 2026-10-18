import { describe, it, expect } from "vitest";
import { DEFAULT_DAILY_QUOTA } from "@/lib/lead-quota";

describe("daily lead quota", () => {
  it("every agent gets 50 leads per day by default", () => {
    expect(DEFAULT_DAILY_QUOTA).toBe(50);
  });
});
