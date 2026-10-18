import { describe, expect, it } from "vitest";
import { requireItProvisioning } from "@/lib/it-provisioning.rules";
describe("IT provisioning authority", () => {
  const allowed = { userId: "architect", tokenUserId: "architect", architectUserId: "architect", authority: true, readOnly: false };
  it("permits an identified Architect with a user-bound IT token", () => expect(() => requireItProvisioning(allowed)).not.toThrow());
  it("rejects a signed-in Architect without the PIN token", () => expect(() => requireItProvisioning({ ...allowed, tokenUserId: null })).toThrow());
  it("rejects another administrator", () => expect(() => requireItProvisioning({ ...allowed, architectUserId: null })).toThrow());
  it("rejects another user's token", () => expect(() => requireItProvisioning({ ...allowed, tokenUserId: "other" })).toThrow());
  it("rejects read-only HQ", () => expect(() => requireItProvisioning({ ...allowed, readOnly: true })).toThrow());
});
