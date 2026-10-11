import { describe, it, expect } from "vitest";
import { shouldRetry, retryDelay } from "../src/lib/query-resilience";

describe("query resilience", () => {
  it("retries transient failures up to 3 times", () => {
    const e = new Error("HTTP 500");
    expect(shouldRetry(0, e)).toBe(true);
    expect(shouldRetry(2, e)).toBe(true);
    expect(shouldRetry(3, e)).toBe(false);
  });
  it("never retries auth or validation errors", () => {
    expect(shouldRetry(0, new Error("Unauthorized"))).toBe(false);
    expect(shouldRetry(0, new Error("403 Forbidden"))).toBe(false);
  });
  it("backs off and caps the delay", () => {
    expect(retryDelay(0)).toBeGreaterThanOrEqual(1000);
    expect(retryDelay(10)).toBeLessThan(15_300);
  });
});
