import { describe, expect, it } from "vitest";

import {
  NOTICE_AUTHORITY,
  NOTICE_READ_ONLY,
  NOTICE_SIGN_IN,
  noticeDecision,
  type NoticeAction,
  type NoticeCaller,
} from "@/lib/notice-board-access";
import { assignmentReasons, followUpScript, type BriefFacts } from "@/lib/precall-brief";

const signedOut: NoticeCaller = { scope: "none", readOnly: false, profile: null };
const agent: NoticeCaller = { scope: "agent", readOnly: false, profile: { id: "p1" } };
const pending: NoticeCaller = { scope: "agent", readOnly: true, profile: { id: "p2" } };
const it_: NoticeCaller = { scope: "authority", readOnly: false, profile: null };
const hqView: NoticeCaller = { scope: "authority", readOnly: true, profile: null };

describe("notice board requests", () => {
  it("signed-out: the list is empty (no page crash), every other action asks to sign in", () => {
    expect(noticeDecision(signedOut, "list")).toEqual({ kind: "empty" });
    for (const action of ["recipients", "publish", "read", "reply"] as NoticeAction[]) {
      expect(noticeDecision(signedOut, action)).toEqual({ kind: "deny", message: NOTICE_SIGN_IN });
    }
  });

  it("signed-in agent: can list, mark read and reply to their own notices", () => {
    expect(noticeDecision(agent, "list").kind).toBe("allow");
    expect(noticeDecision(agent, "read").kind).toBe("allow");
    expect(noticeDecision(agent, "reply").kind).toBe("allow");
  });

  it("unauthorized: an agent can never publish or see the recipient list", () => {
    expect(noticeDecision(agent, "publish")).toEqual({ kind: "deny", message: NOTICE_AUTHORITY });
    expect(noticeDecision(agent, "recipients")).toEqual({ kind: "deny", message: NOTICE_AUTHORITY });
    expect(noticeDecision(pending, "reply")).toEqual({ kind: "deny", message: NOTICE_READ_ONLY });
  });

  it("IT publishes; a read-only HQ view can see recipients but not publish", () => {
    expect(noticeDecision(it_, "publish").kind).toBe("allow");
    expect(noticeDecision(hqView, "recipients").kind).toBe("allow");
    expect(noticeDecision(hqView, "publish")).toEqual({ kind: "deny", message: NOTICE_READ_ONLY });
    // PIN sessions have no personal inbox: marking read is a harmless no-op.
    expect(noticeDecision(it_, "read")).toEqual({ kind: "empty" });
  });
});

describe("why-this-lead brief", () => {
  const base: BriefFacts = {
    name: "Rahim", referenceBy: null, source: "Facebook", temperature: null, grade: null, attempts: 0,
    lastCallAt: null, requirement: null, interest: null, customerResponse: null, lastNextAction: null,
    lastCategory: null, lastSummary: null, followUpAt: null, followUpOverdue: false, inventoryMatch: null,
  };

  it("explains an overdue HOT follow-up from saved facts only", () => {
    const why = assignmentReasons({ ...base, attempts: 2, lastCallAt: "2026-09-20T05:00:00Z", temperature: "hot", followUpAt: "2026-09-25T05:00:00Z", followUpOverdue: true, requirement: "3 bed Bashundhara" });
    expect(why[0]).toContain("পার হয়ে গেছে");
    expect(why.join(" ")).toContain("HOT");
    expect(why.join(" ")).toContain("3 bed Bashundhara");
  });

  it("marks a brand-new lead and always ends the script with a follow-up ask", () => {
    expect(assignmentReasons(base)[0]).toContain("নতুন লিড");
    const script = followUpScript(base);
    expect(script.at(-1)).toContain("ফলো-আপ");
  });
});
