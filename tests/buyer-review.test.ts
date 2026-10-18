import { expect, it } from "vitest";
import { selectedBuyerFields } from "../src/lib/buyer-review";

it("unchecked Gemini fields never enter the reviewed payload", () => {
  expect(selectedBuyerFields({ budget: { value: "85 lakh" } }, [])).toEqual({});
});
it("only explicitly selected evidence-backed fields enter the payload", () => {
  const budget = { value: "85 lakh", evidence: "budget 85 lakh" };
  expect(selectedBuyerFields({ budget, timeline: { value: "November" } }, ["budget", "nrb"])).toEqual({ budget });
});