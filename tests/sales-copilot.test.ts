import { describe, expect, it } from "vitest";

import {
  COPILOT_LANGUAGE_CODES,
  COPILOT_LANGUAGES,
  OBJECTION_LIBRARY,
  buildPropertyMatch,
  copilotPromptInstruction,
  isCopilotLanguage,
  languageLabel,
  normalizeLanguage,
  numbersGrounded,
  parseCopilotAi,
  type PropertyCandidateInput,
} from "@/lib/sales-copilot.rules";
import { OBJECTIONS, OBJECTION_FACT_CATEGORIES, FACT_CATEGORY_CODES } from "@/lib/sales-intel-rules";

describe("objection library", () => {
  it("covers every objection code with Bengali intent, questions and next action", () => {
    for (const o of OBJECTIONS) {
      const e = OBJECTION_LIBRARY[o.code];
      expect(e.intent.trim()).not.toBe("");
      expect(e.questions.length).toBeGreaterThanOrEqual(1);
      expect(e.nextAction.trim()).not.toBe("");
      // Rule content never contains numbers (facts come from verified market_facts only).
      expect(e.intent).not.toMatch(/\d|[\u09E6-\u09EF]/);
      for (const q of e.questions) expect(q).not.toMatch(/\d|[\u09E6-\u09EF]/);
      expect(e.nextAction).not.toMatch(/\d|[\u09E6-\u09EF]/);
    }
  });

  it("maps every objection to existing fact categories", () => {
    for (const o of OBJECTIONS) {
      for (const cat of OBJECTION_FACT_CATEGORIES[o.code]) expect(FACT_CATEGORY_CODES).toContain(cat);
    }
  });
});

describe("copilot languages", () => {
  it("supports Bangla, Banglish and English with a Bengali default", () => {
    expect(COPILOT_LANGUAGE_CODES).toEqual(["bn", "bnlish", "en"]);
    expect(COPILOT_LANGUAGES.map((l) => l.label)).toEqual(["বাংলা", "Banglish", "English"]);
    expect(normalizeLanguage("en")).toBe("en");
    expect(normalizeLanguage("nonsense")).toBe("bn");
    expect(isCopilotLanguage("bnlish")).toBe(true);
    expect(languageLabel("bn")).toBe("বাংলা");
  });

  it("tells the AI never to invent facts and always to cite only provided numbers", () => {
    for (const lang of COPILOT_LANGUAGE_CODES) {
      const p = copilotPromptInstruction(lang);
      expect(p).toMatch(/Only/i);
      expect(p).toMatch(/never/i);
      expect(p).toContain("next_question");
    }
  });
});

describe("numbersGrounded", () => {
  it("accepts numbers present in the pool and rejects invented ones", () => {
    const pool = "interest rate 11.5% · price 85";
    expect(numbersGrounded("Rate is 11.5% now", pool)).toBe(true);
    expect(numbersGrounded("সুদ ১১.৫% আছে", pool)).toBe(true); // Bengali digits map to the pool
    expect(numbersGrounded("Rate is 12.5% now", pool)).toBe(false);
    expect(numbersGrounded("No numbers here", pool)).toBe(true);
  });
});

describe("parseCopilotAi", () => {
  const pool = "budget 50 lakh · rate 11.5%";

  it("keeps a valid grounded answer and only the allowed fact ids", () => {
    const r = parseCopilotAi(
      JSON.stringify({ intent: "wants lower price", response: "Budget 50 lakh e options ache", fact_ids: ["f1", "fX"], next_question: "Koy mono budget?", next_action: null }),
      ["f1"],
      pool,
    );
    expect(r).not.toBeNull();
    expect(r!.response).toContain("50 lakh");
    expect(r!.factIds).toEqual(["f1"]);
    expect(r!.nextQuestion).toBe("Koy mono budget?");
    expect(r!.nextAction).toBeNull();
  });

  it("returns null for ungrounded numbers, bad JSON or missing response", () => {
    expect(parseCopilotAi("not json", ["f1"], pool)).toBeNull();
    expect(parseCopilotAi(JSON.stringify({ response: "Price is 92 now" }), ["f1"], pool)).toBeNull();
    expect(parseCopilotAi(JSON.stringify({ response: "" }), ["f1"], pool)).toBeNull();
    expect(parseCopilotAi(JSON.stringify({ response: "ok", next_question: "call at 9 sharp" }), ["f1"], pool)).toBeNull();
  });
});

describe("buildPropertyMatch", () => {
  const candidates: PropertyCandidateInput[] = [
    { id: "p-uttara", category: "project_property", geography: "Uttara Dhaka", metric: "Ready 2-bedroom flat", value: "85 lakh", unit: null, sourceName: "HQ", sourceUrl: null, effectiveDate: "2026-10-01", eligibility: "authoritative", version: 1, notes: "ready flat" },
    { id: "p-mirpur", category: "project_property", geography: "Mirpur", metric: "Under-construction apartment", value: "60 lakh", unit: null, sourceName: "HQ", sourceUrl: null, effectiveDate: "2026-10-01", eligibility: "authoritative", version: 1, notes: "installment" },
  ];

  it("ranks by area and requirement overlap and explains why", () => {
    const m = buildPropertyMatch({ leadArea: "Uttara", leadAddress: "Sector 7, Uttara, Dhaka", requirement: "ready 2 bedroom flat", candidates });
    expect(m[0]!.fact.id).toBe("p-uttara");
    expect(m[0]!.why.some((w) => w.toLowerCase().includes("uttara"))).toBe(true);
    expect(m[0]!.score).toBeGreaterThan(m[1]!.score);
  });

  it("returns empty when nothing matches — no invented match", () => {
    expect(buildPropertyMatch({ leadArea: "Sylhet", leadAddress: null, requirement: null, candidates })).toEqual([]);
  });

  it("matches on requirement keywords alone", () => {
    const m = buildPropertyMatch({ leadArea: null, leadAddress: null, requirement: "installment plan", candidates });
    expect(m.map((x) => x.fact.id)).toContain("p-mirpur");
  });
});
