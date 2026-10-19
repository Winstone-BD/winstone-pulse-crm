import { describe, expect, it } from "vitest";
import { formatTaka, kathaToSqft, normalizeBdPhone, sqftToKatha, DHAKA_LOCATIONS } from "@/lib/bd-format";
import { extractQualification, scoreQualification, qualifyConversation, sortByPriority } from "@/lib/lead-qualification";
import { buildSchedule, validateSchedule, DEFAULT_MILESTONES } from "@/lib/payment-schedule";

describe("BD formats", () => {
  it("formats Lakh and Crore", () => {
    expect(formatTaka(17_500_000)).toBe("৳1.75 Cr");
    expect(formatTaka(8_500_000)).toBe("৳85 L");
    expect(formatTaka(8_500_000, "bn")).toBe("৳৮৫ লাখ");
    expect(formatTaka(50_000)).toBe("৳50,000");
  });
  it("1 Katha = 720 sq ft", () => {
    expect(kathaToSqft(3)).toBe(2160);
    expect(sqftToKatha(1440)).toBe(2);
  });
  it("validates +880 1X numbers", () => {
    expect(normalizeBdPhone("01712-345678")).toBe("+8801712345678");
    expect(normalizeBdPhone("+880 1912 345678")).toBe("+8801912345678");
    expect(normalizeBdPhone("০১৮১২৩৪৫৬৭৮")).toBe("+8801812345678");
    expect(normalizeBdPhone("01212345678")).toBeNull();
    expect(normalizeBdPhone("0171234567")).toBeNull();
  });
  it("has the seven Dhaka areas", () => {
    expect(DHAKA_LOCATIONS.map((l) => l.en)).toEqual(["Gulshan", "Banani", "Dhanmondi", "Uttara", "Bashundhara", "Purbachal", "Mirpur"]);
  });
});

describe("WhatsApp qualification", () => {
  it("reads Banglish", () => {
    const q = extractQualification("Bhai 1.5 koti budget, Bashundhara te 3 bed 3 bath flat lagbe, ekhoni kinbo");
    expect(q).toMatchObject({ budgetBdt: 15_000_000, location: "bashundhara", bedrooms: 3, bathrooms: 3, timeline: "immediate" });
  });
  it("reads Bangla", () => {
    const q = extractQualification("আমার বাজেট ৮০ লাখ, উত্তরায় ২ বেড চাই, ৩ মাসের মধ্যে");
    expect(q).toMatchObject({ budgetBdt: 8_000_000, location: "uttara", bedrooms: 2, timeline: "within_3_months" });
  });
  it("full info + visit is hot and prioritised", () => {
    const s = scoreQualification(qualifyConversation(["90 lakh Mirpur 3 bed 2 bath", "urgent, site visit possible?"]));
    expect(s.temperature).toBe("hot");
    expect(s.priority).toBe(true);
  });
  it("no info is cold", () => {
    expect(scoreQualification(extractQualification("hello")).temperature).toBe("cold");
  });
  it("hot leads sort first", () => {
    const hot = scoreQualification(qualifyConversation(["1 crore gulshan 4 bed 4 bath asap visit"]));
    const cold = scoreQualification(extractQualification("hi"));
    const out = sortByPriority([{ id: "c", score: cold, lastAt: "2026-10-19" }, { id: "h", score: hot, lastAt: "2026-10-01" }]);
    expect(out[0].id).toBe("h");
  });
});

describe("payment schedule", () => {
  const base = { totalBdt: 10_000_000, downPaymentPct: 20, installmentMonths: 36, installmentPct: 50, milestones: DEFAULT_MILESTONES, startDate: "2026-10-19" };
  it("rows sum to total and handover gets the rest", () => {
    const rows = buildSchedule(base);
    expect(rows.reduce((a, r) => a + r.amountBdt, 0)).toBe(10_000_000);
    expect(rows[0].amountBdt).toBe(2_000_000);
    expect(rows.filter((r) => r.kind === "installment")).toHaveLength(36);
    expect(rows.at(-1)).toMatchObject({ kind: "handover", amountBdt: 1_000_000 });
  });
  it("rejects plans over 100%", () => {
    expect(validateSchedule({ ...base, installmentPct: 80 })).toMatch(/exceed/);
  });
});
