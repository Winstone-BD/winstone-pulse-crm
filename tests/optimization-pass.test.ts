import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createRateLimiter } from "@/lib/rate-limit";
import { categoryForScore, evaluate, MAX_SCORE, parseAnswers, priorityFor } from "@/lib/lead-evaluation";

describe("locked V2 evaluation", () => {
  it("points, max and bands", () => {
    const all = parseAnswers({ project_interest: true, asked_price: true, wanted_info: true, visit_interest: true, decision_30d: true, wants_follow_up: true })!;
    expect(evaluate(all, false).score).toBe(90);
    expect(MAX_SCORE).toBe(90);
    expect([0, 20, 21, 50, 51, 90].map(categoryForScore)).toEqual(["cold", "cold", "warm", "warm", "hot", "hot"]);
  });
  it("follow-up priority independent of score", () => {
    expect(priorityFor("hot", false)).toBeNull();
    expect(priorityFor("hot", true)).toBe("high");
    expect(priorityFor("warm", true)).toBe("medium");
    expect(priorityFor("cold", true)).toBe("low");
  });
  it("rejects partial answers", () => {
    expect(parseAnswers({ project_interest: true })).toBeNull();
  });
});

describe("bridge rate limiter", () => {
  it("blocks after limit and resets per window", () => {
    const allow = createRateLimiter(2, 1000);
    expect([allow("a", 0), allow("a", 1), allow("a", 2)]).toEqual([true, true, false]);
    expect(allow("b", 2)).toBe(true);
    expect(allow("a", 1000)).toBe(true);
  });
});

describe("inbound lead intake", () => {
  it("never auto-assigns or trusts a payload agent_id", () => {
    const src = readFileSync("src/routes/api/public/ingest/lead.ts", "utf8");
    expect(src).not.toMatch(/Round-robin/);
    expect(src).toMatch(/caller\.kind === "device" \? caller\.profile\.id : null/);
  });
});
