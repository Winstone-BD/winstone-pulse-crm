import { expect, it } from "vitest";
import { requireReviewAction } from "../src/lib/hq-review.rules";
it("HQ can append a review comment", () => {
  expect(() => requireReviewAction(true, "noted")).not.toThrow();
});
it.each(["in_progress", "fixed", "verified", "reopened", "wont_fix"])("HQ cannot set operational remediation status %s", action => {
  expect(() => requireReviewAction(true, action)).toThrow("review comments only");
});
it("IT retains remediation status management", () => {
  expect(() => requireReviewAction(false, "fixed")).not.toThrow();
});