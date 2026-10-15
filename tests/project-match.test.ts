import { describe, expect, it } from "vitest";
import { matchProjects, parseBDT } from "@/lib/project-match";
import { parsePair } from "@/lib/sales-drafts.server";

describe("taka reader", () => {
  it("reads lakh/crore/plain/bengali digits", () => {
    expect(parseBDT("85 lakh")).toBe(8_500_000);
    expect(parseBDT("1.2 crore")).toBe(12_000_000);
    expect(parseBDT("৳ 45,00,000")).toBe(4_500_000);
    expect(parseBDT("৮৫ লাখ")).toBe(8_500_000);
    expect(parseBDT("abc")).toBeNull();
  });
});
describe("project matching", () => {
  const rows = [
    { id: "a", name: "A", location: "Uttara", status: "active", total_price: "80 lakh", down_payment: "20%", installment_plan: "36 months" },
    { id: "b", name: "B", location: "Purbachal", status: "active", total_price: null, down_payment: null, installment_plan: null },
  ];
  it("computes money and flags unknowns instead of inventing", () => {
    const [a, b] = matchProjects({ maxBudget: 8_500_000, area: "uttara", units: 1, months: 48 }, rows);
    expect(a!.total).toBe(8_000_000);
    expect(a!.downPayment).toBe(1_600_000);
    expect(a!.months).toBe(36);
    expect(a!.monthly).toBe(Math.round(6_400_000 / 36));
    expect(a!.budgetOk).toBe(true);
    expect(b!.total).toBeNull();
    expect(b!.warnings.join()).toContain("তথ্য যাচাই প্রয়োজন");
  });
});
describe("AI pair parsing", () => {
  it("requires both messages", () => {
    expect(parsePair('x {"whatsapp":"w","sms":"s","when":"t"}').sms).toBe("s");
    expect(() => parsePair('{"whatsapp":"w"}')).toThrow();
  });
});
