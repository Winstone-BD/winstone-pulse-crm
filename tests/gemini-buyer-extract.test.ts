import { describe, it, expect } from "vitest";
import { parseExtraction } from "@/lib/buyer-extract.server";
import { applyExtraction, buildTemplate, VERIFY } from "@/lib/agent-templates";

describe("Gemini buyer extraction — parse", () => {
  it("parses found fields with evidence and skips nulls", () => {
    const out = parseExtraction(
      'Here: {"budget":{"value":"৮৫ লাখ","evidence":"বাজেট ৮৫ লাখ বলেছেন"},"property_type":{"value":"ফ্ল্যাট","evidence":"ফ্ল্যাট চাই"},"timeline":{"value":null,"evidence":null},"decision_maker":null,"installment":{"value":null,"evidence":null},"nrb":{"value":"yes","evidence":"প্রবাসী"}}',
    );
    expect(out.budget?.value).toBe("৮৫ লাখ");
    expect(out.budget?.evidence).toContain("৮৫ লাখ");
    expect(out.property_type?.value).toBe("ফ্ল্যাট");
    expect(out.nrb?.value).toBe("yes");
    expect(out.timeline).toBeUndefined();
    expect(out.decision_maker).toBeUndefined();
  });

  it("treats the string \"null\" and blanks as missing", () => {
    const out = parseExtraction('{"budget":{"value":"null"},"property_type":{"value":"  "},"timeline":{"value":"ঢাকার"},"decision_maker":{"value":null},"installment":{"value":null},"nrb":{"value":null}}');
    expect(out.budget).toBeUndefined();
    expect(out.property_type).toBeUndefined();
    expect(out.timeline?.value).toBe("ঢাকার");
  });

  it("caps value and evidence length", () => {
    const out = parseExtraction(JSON.stringify({ budget: { value: "৮".repeat(500), evidence: "x".repeat(500) } }));
    expect(out.budget!.value.length).toBe(120);
    expect(out.budget!.evidence.length).toBe(160);
  });

  it("throws a friendly error on unreadable output", () => {
    expect(() => parseExtraction("I cannot help with that")).toThrow(/unreadable/);
    expect(() => parseExtraction("{not json}")).toThrow(/unreadable/);
  });
});

describe("Gemini buyer extraction — apply into the draft", () => {
  const base = buildTemplate("buyer_check", { name: "করিম", requirement: "৩ বেড", area: "মিরপুর" }).text;

  it("fills only untouched verify lines and marks them Gemini", () => {
    const out = applyExtraction(base, {
      budget: { value: "৮৫ লাখ", evidence: "e" },
      timeline: { value: "৬ মাসের মধ্যে", evidence: "e" },
    });
    expect(out).toContain(`বাজেট (সর্বোচ্চ ৳): ৮৫ লাখ (Gemini)`);
    expect(out).toContain(`কবে কিনতে চান: ৬ মাসের মধ্যে (Gemini)`);
    // untouched fields keep the verify marker
    expect(out).toContain(`সিদ্ধান্ত কে নেবেন: ${VERIFY}`);
    expect(out).toContain(`প্রবাসী (NRB) কি না: ${VERIFY}`);
  });

  it("never overwrites a line the agent already edited", () => {
    const edited = base.replace(`বাজেট (সর্বোচ্চ ৳): ${VERIFY}`, "বাজেট (সর্বোচ্চ ৳): ৯০ লাখ (নিজে লিখেছি)");
    const out = applyExtraction(edited, { budget: { value: "৮৫ লাখ", evidence: "e" } });
    expect(out).toContain("৯০ লাখ (নিজে লিখেছি)");
    expect(out).not.toContain("(Gemini)");
  });

  it("strips angle brackets from suggested values", () => {
    const out = applyExtraction(base, { budget: { value: "<b>৮৫ লাখ</b>", evidence: "e" } });
    expect(out).toContain(`বাজেট (সর্বোচ্চ ৳): b৮৫ লাখ/b (Gemini)`);
    expect(out).not.toContain("<b>");
  });

  it("leaves text unchanged when nothing was found", () => {
    expect(applyExtraction(base, {})).toBe(base);
  });
});
