import { describe, expect, it } from "vitest";
import { clampBrief, ruleBrief, type BriefFacts } from "@/lib/precall-brief";

const empty: BriefFacts = {
  name: "রহিম", referenceBy: null, source: null, temperature: null, grade: null, attempts: 0,
  lastCallAt: null, requirement: null, interest: null, customerResponse: null, lastNextAction: null,
  lastCategory: null, lastSummary: null, followUpAt: null, followUpOverdue: false, inventoryMatch: null,
};

describe("pre-call quick brief", () => {
  it("first contact with no data never invents facts", () => {
    const b = ruleBrief(empty);
    expect(b.line).toContain("প্রথম কল");
    expect(b.line).not.toMatch(/৳|budget|বাজেট ~/);
    expect(b.source).toBe("rules");
  });
  it("uses only supplied facts incl. next move and overdue follow-up", () => {
    const b = ruleBrief({ ...empty, requirement: "Uttara 3-bed", temperature: "hot", grade: "A", attempts: 2,
      lastCallAt: "2026-09-20T05:00:00Z", followUpAt: "2026-09-25T05:00:00Z", followUpOverdue: true, lastNextAction: "সাইট ভিজিট নিশ্চিত" });
    expect(b.line).toContain("Uttara 3-bed");
    expect(b.line).toContain("HOT/A");
    expect(b.line).toContain("মেয়াদোত্তীর্ণ");
    expect(b.line).toContain("সাইট ভিজিট নিশ্চিত");
  });
  it("clamps AI output to one short line", () => {
    expect(clampBrief("a\n\nb   c long enough")).toBe("a b c long enough");
    expect(clampBrief("")).toBeNull();
    expect(clampBrief("x".repeat(400))!.length).toBe(220);
  });
});
