import { expect, it } from "vitest";
import { assignedAgentLeads, requireHqLeadReview } from "../src/lib/hq-lead-review.rules";
it("HQ can comment on a currently assigned eligible agent lead without agent PIN", () => {
  expect(() => requireHqLeadReview("authority", "agent-1", "agent-1", true)).not.toThrow();
});
it.each(["agent", "coordinator", "none"])("%s cannot use HQ review delivery", scope => {
  expect(() => requireHqLeadReview(scope, "agent-1", "agent-1", true)).toThrow("HQ/IT access required");
});
it("rejects changed owners", () => expect(() => requireHqLeadReview("authority", "agent-2", "agent-1", true)).toThrow("ownership"));
it("rejects unavailable agents", () => expect(() => requireHqLeadReview("authority", "agent-1", "agent-1", false)).toThrow("availability"));
it("agent lead view respects canonical owner precedence and fallback", () => {
  expect(assignedAgentLeads([{ assigned_to: "a", assigned_agent_id: "b" }, { assigned_agent_id: "a" }, { assigned_to: "b" }], "a")).toEqual([{ assigned_to: "a", assigned_agent_id: "b" }, { assigned_agent_id: "a" }]);
});