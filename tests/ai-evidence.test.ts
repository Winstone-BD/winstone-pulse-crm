import { describe, expect, it } from "vitest";
import { supportedEvidence } from "@/lib/ai-evidence";
import { groundExtraction } from "@/lib/buyer-extract.server";
describe("AI source evidence", () => {
  it("keeps a buyer suggestion supported by the saved note", () => expect(groundExtraction({ budget: { value: "85 lakh", evidence: "budget 85 lakh" } }, "Buyer budget 85 lakh").budget?.value).toBe("85 lakh"));
  it("drops invented buyer evidence", () => expect(groundExtraction({ budget: { value: "85 lakh", evidence: "budget 85 lakh" } }, "No budget stated").budget).toBeUndefined());
  it("drops suggestions without evidence", () => expect(groundExtraction({ budget: { value: "85 lakh", evidence: "" } }, "Buyer notes").budget).toBeUndefined());
  it("accepts normalized quotes but not fabricated citations", () => { expect(supportedEvidence("flat in Dhaka", "A flat\nin Dhaka")).toBe(true); expect(supportedEvidence("free parking", "parking unconfirmed")).toBe(false); });
});
