import { describe, expect, it } from "vitest";
import { requireItProvisioning, requireItOnboardingStep } from "@/lib/it-provisioning.rules";
describe("IT provisioning authority", () => {
  const allowed = { userId: "architect", tokenUserId: "architect", architectUserId: "architect", authority: true, readOnly: false };
  it("permits an identified Architect with a user-bound IT token", () => expect(() => requireItProvisioning(allowed)).not.toThrow());
  it("rejects a signed-in Architect without the PIN token", () => expect(() => requireItProvisioning({ ...allowed, tokenUserId: null })).toThrow());
  it("rejects another administrator", () => expect(() => requireItProvisioning({ ...allowed, architectUserId: null })).toThrow());
  it("rejects another user's token", () => expect(() => requireItProvisioning({ ...allowed, tokenUserId: "other" })).toThrow());
  it("rejects read-only HQ", () => expect(() => requireItProvisioning({ ...allowed, readOnly: true })).toThrow());
});
it("cannot approve before password setup", () => expect(() => requireItOnboardingStep("invited", "approve", true)).toThrow("Password setup"));
it("can approve after verified password setup", () => expect(() => requireItOnboardingStep("password_set", "approve", true)).not.toThrow());
it("cannot grant IT role before approval", () => expect(() => requireItOnboardingStep("password_set", "assign_role", true)).toThrow("Approval required"));
it("grants role only after approval and email verification", () => {
  expect(() => requireItOnboardingStep("approved", "assign_role", true)).not.toThrow();
  expect(() => requireItOnboardingStep("approved", "assign_role", false)).toThrow("Verified email");
});
it("rejects role-assignment replays", () => expect(() => requireItOnboardingStep("active", "assign_role", true)).toThrow());
