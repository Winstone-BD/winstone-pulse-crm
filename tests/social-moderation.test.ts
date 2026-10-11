import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dhakaDayStart, SOCIAL_LEAD_SOURCE, summariseSocial } from "@/lib/social.functions";

const src = readFileSync("src/lib/social.functions.ts", "utf8");
const mig = readdirSync("drizzle/migrations").filter((f) => f.includes("social_moderation"))
  .map((f) => readFileSync(`drizzle/migrations/${f}`, "utf8")).join("\n");

describe("social moderation (Method A)", () => {
  it("converted leads are always unassigned and go through the shared intake/dedupe path", () => {
    expect(src).toMatch(/intakeLead\(\{[\s\S]*ownerId: null/);
    expect(src).not.toMatch(/assigned_to|assigned_agent_id/);
    expect(Object.values(SOCIAL_LEAD_SOURCE)).toEqual(["facebook_inbox", "facebook_comment", "facebook_group"]);
  });

  it("agent id comes from the session and every agent write passes the briefing gate", () => {
    expect(src).not.toMatch(/agentId:\s*z\./);
    expect(src).toMatch(/assertBriefingForCaller\(c\.caller\)/);
    for (const fn of ["logSocialActivity", "voidSocialActivity", "convertSocialToLead"]) {
      expect(src).toMatch(new RegExp(`${fn}[\\s\\S]*?agentCtx\\(`));
    }
  });

  it("never calls any Meta/Facebook API", () => {
    expect(src).not.toMatch(/graph\.facebook|fetch\(/);
  });

  it("history is append-only: delete blocked, only void or first lead link may change", () => {
    expect(mig).toMatch(/BEFORE UPDATE OR DELETE ON public\.social_activity_logs/);
    expect(mig).toMatch(/append-only/);
    expect(mig).toMatch(/agents read own social activity[\s\S]*auth\.uid\(\)/);
    expect(mig).not.toMatch(/GRANT (INSERT|UPDATE|DELETE|ALL)[^;]*TO authenticated/);
  });

  it("report ignores voided entries and counts real visits/bookings only", () => {
    const rows = summariseSocial(
      [
        { agent_id: "a", reply_count: 3, lead_id: "L1", voided_at: null },
        { agent_id: "a", reply_count: 9, lead_id: null, voided_at: "2026-10-11T00:00:00Z" },
        { agent_id: "b", reply_count: 1, lead_id: "L2", voided_at: null },
      ],
      new Map([["a", "Rina"]]), new Set(["L1"]), new Set<string>(),
    );
    expect(rows).toEqual([
      { agentId: "a", name: "Rina", entries: 1, replies: 3, leads: 1, visits: 1, bookings: 0 },
      { agentId: "b", name: "—", entries: 1, replies: 1, leads: 1, visits: 0, bookings: 0 },
    ]);
  });

  it("day starts at Dhaka midnight", () => {
    expect(dhakaDayStart(Date.parse("2026-10-11T18:50:00Z"))).toBe("2026-10-11T18:00:00.000Z");
    expect(dhakaDayStart(Date.parse("2026-10-11T17:59:00Z"))).toBe("2026-10-10T18:00:00.000Z");
  });
});
