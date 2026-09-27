import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => null }));

import { deckAccess, isSellTeamAdmin, requireAuthority, requireDeck, requireDispatch, type Caller } from "@/lib/access.server";
import { LEAD_STATUS_FOR, validateReport } from "@/lib/call-reports.server";
import { HEAD_DATABASE_SOURCE, leadsNeededForNextRound } from "@/lib/head-lead";
import { quotaFor } from "@/lib/lead-quota";

const profile = (employee_id: string) => ({ id: "p", name: "X", employee_id }) as unknown as Caller["profile"];
const caller = (scope: Caller["scope"], employeeId = "WIN2601", readOnly = false): Caller => ({
  scope,
  profile: profile(employeeId),
  userId: "u",
  approval: "approved",
  readOnly,
});

describe("Coordinator Deck access", () => {
  it("gives Haidar (WIN2607) intake-only deck access", () => {
    const haidar = caller("agent", "WIN2607");
    expect(isSellTeamAdmin(haidar)).toBe(true);
    expect(deckAccess(haidar)).toBe("intake");
    expect(() => requireDeck(haidar)).not.toThrow();
  });

  it("never gives Haidar dispatch or IT/authority powers", () => {
    const haidar = caller("agent", "WIN2607");
    expect(() => requireDispatch(haidar)).toThrow();
    expect(() => requireAuthority(haidar)).toThrow();
  });

  it("keeps ordinary agents out of the deck", () => {
    expect(deckAccess(caller("agent", "WIN2601"))).toBe("none");
    expect(() => requireDeck(caller("agent", "WIN2601"))).toThrow();
  });

  it("gives coordinators and authority the full deck", () => {
    expect(deckAccess(caller("coordinator"))).toBe("full");
    expect(deckAccess(caller("authority"))).toBe("full");
  });

  it("does not grant intake on a read-only session", () => {
    expect(isSellTeamAdmin(caller("agent", "WIN2607", true))).toBe(false);
  });
});

describe("head database round", () => {
  it("uses the head-database source for intake", () => {
    expect(HEAD_DATABASE_SOURCE).toBe("head_database");
  });

  it("gives everyone including Haidar 50/day", () => {
    expect(quotaFor("WIN2607", 50)).toBe(50);
    expect(quotaFor("WIN2601", 50)).toBe(50);
  });

  it("reports how many more leads the next full round needs", () => {
    expect(leadsNeededForNextRound(100, 8, 50)).toBe(300);
    expect(leadsNeededForNextRound(500, 8, 50)).toBe(0);
  });
});

describe("report category → lead status", () => {
  it("maps every canonical category consistently", () => {
    expect(LEAD_STATUS_FOR).toEqual({
      hot_lead: "follow_up",
      follow_up: "follow_up",
      interested: "contacted",
      not_interested: "closed",
      callback: "follow_up",
      no_answer: "contacted",
      wrong_number: "closed",
      closed_converted: "closed",
    });
  });

  it("rejects NO ANSWER on a connected call", () => {
    expect(
      validateReport({
        category: "no_answer",
        summary: "কথা হয়েছে",
        note: "পরে কল",
        temperature: "warm",
        grade: "B",
        requireCallFacts: true,
        direction: "outgoing",
        callStatus: "connected",
        durationSeconds: 40,
        followUpAt: "2026-10-01T10:00:00.000Z",
      })?.field,
    ).toBe("category");
  });

  it("requires follow-up time or an explicit no-follow-up reason", () => {
    const base = {
      category: "interested",
      summary: "দাম জানতে চেয়েছেন",
      note: "কোটেশন",
      temperature: "warm",
      grade: "B",
      requireCallFacts: true,
      direction: "outgoing",
      callStatus: "connected",
      durationSeconds: 60,
    };
    expect(validateReport(base)?.field).toBe("followUpAt");
    expect(validateReport({ ...base, followUpNeeded: false, followUpNote: "কিনে ফেলেছেন" })).toBeNull();
  });
});
