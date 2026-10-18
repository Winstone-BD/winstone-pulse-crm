import { describe, expect, it } from "vitest";
import { draftInstruction } from "@/lib/instruction-copilot";
describe("free instruction drafts", () => {
  it("prepares the requested 25 leads without executing an action", () => {
    expect(draftInstruction("WIN2607-কে ২৫ লিড দিন")).toEqual({ kind: "assignment", employeeId: "WIN2607", count: 25 });
  });
  it("keeps a missing agent unresolved", () => {
    expect(draftInstruction("send 30 leads")).toEqual({ kind: "assignment", employeeId: null, count: 30 });
  });
  it("does not guess an ambiguous quantity", () => {
    expect(draftInstruction("assign 20 or 30 leads to WIN2607")).toEqual({ kind: "assignment", employeeId: "WIN2607", count: null });
  });
  it("does not accept fractions as a lead quantity", () => {
    expect(draftInstruction("assign 2.5 leads to WIN2607")).toEqual({ kind: "assignment", employeeId: "WIN2607", count: null });
  });
});