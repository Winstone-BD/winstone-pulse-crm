import { describe, expect, it } from "vitest";
import { evaluate, parseAnswers, scoreAnswers, categoryForScore, priorityFor, MAX_SCORE } from "@/lib/lead-evaluation";

const all = (v: boolean) => ({
  project_interest: v, asked_price: v, wanted_info: v, visit_interest: v, decision_30d: v, wants_follow_up: v,
});

describe("locked V2 lead evaluation", () => {
  it("max is 90 and all-no is 0", () => {
    expect(scoreAnswers(all(true))).toBe(MAX_SCORE);
    expect(scoreAnswers(all(false))).toBe(0);
  });
  it("bands 0-20 cold, 21-50 warm, 51-90 hot", () => {
    expect(categoryForScore(20)).toBe("cold");
    expect(categoryForScore(21)).toBe("warm");
    expect(categoryForScore(50)).toBe("warm");
    expect(categoryForScore(51)).toBe("hot");
  });
  it("priority from category only when follow-up pending", () => {
    expect(priorityFor("hot", true)).toBe("high");
    expect(priorityFor("warm", true)).toBe("medium");
    expect(priorityFor("cold", true)).toBe("low");
    expect(priorityFor("hot", false)).toBeNull();
  });
  it("rejects incomplete answers", () => {
    expect(parseAnswers({ project_interest: true })).toBeNull();
    expect(parseAnswers(all(false))).not.toBeNull();
  });
  it("interest + price = 30 warm", () => {
    const r = evaluate({ ...all(false), project_interest: true, asked_price: true }, true);
    expect(r).toMatchObject({ score: 30, category: "warm", priority: "medium" });
  });
});
