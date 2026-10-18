import { describe, expect, it } from "vitest";
import { normalizeAgentResult, NO_ANSWER_MESSAGE } from "../src/lib/command-agent-result";

describe("CommandAgentPanel result handling", () => {
  it.each([undefined, null, "text", 42, {}, { answer: 5 }, { answer: "" }, { answer: "   " }])(
    "turns %p into an error instead of crashing",
    (input) => {
      expect(normalizeAgentResult(input)).toEqual({ ok: false, error: NO_ANSWER_MESSAGE });
    },
  );

  it("drops malformed facts and actions but keeps the answer", () => {
    const out = normalizeAgentResult({
      answer: "ঠিক আছে",
      facts: ["a", 1, null],
      actions: [{ type: "x", label: "X" }, { label: "no type" }, null],
    });
    expect(out).toEqual({ ok: true, answer: "ঠিক আছে", facts: ["a"], actions: [{ type: "x", label: "X", params: {} }] });
  });
});
