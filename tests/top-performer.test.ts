import { describe, expect, it } from "vitest";

import {
  performerInsight,
  rankPerformers,
  scoreOf,
  topPerformerDate,
  type PerformerLine,
} from "@/lib/top-performer.server";

const line = (overrides: Partial<PerformerLine> = {}): PerformerLine => ({
  agentId: "agent-1",
  name: "Agent 1",
  called: 10,
  connected: 5,
  reports: 10,
  followUps: 5,
  talkMinutes: 20,
  connectRate: 50,
  score: 56,
  quota: 50,
  targetQuota: 50,
  assigned: 50,
  completed: 0,
  completionPercent: 0,
  fairScore: 56,
  ...overrides,
});

describe("Top 3 performer intelligence", () => {
  it("keeps the agreed transparent scoring weights", () => {
    expect(
      scoreOf({
        agentId: "agent-1",
        name: "Agent 1",
        called: 10,
        connected: 5,
        reports: 10,
        followUps: 5,
        talkMinutes: 20,
      }),
    ).toBe(55.5);
  });

  it("ranks by the displayed score, highest first — not by quota completion", () => {
    const lowScoreFinishedQuota = line({
      agentId: "a",
      name: "Debbroto",
      score: 2,
      completed: 1,
      targetQuota: 50,
      assigned: 50,
      completionPercent: 2,
    });
    const highScoreEmptyQuota = line({
      agentId: "b",
      name: "Monisha",
      score: 39,
      completed: 0,
      targetQuota: 50,
      assigned: 0,
      completionPercent: 0,
    });
    const ranked = rankPerformers([lowScoreFinishedQuota, highScoreEmptyQuota]);
    expect(ranked[0].agentId).toBe("b");
    expect(ranked[1].agentId).toBe("a");
  });

  it("breaks score ties by quota completion, then connections, then reports", () => {
    const tieA = line({ agentId: "a", score: 30, completionPercent: 20, connected: 3 });
    const tieB = line({ agentId: "b", score: 30, completionPercent: 40, connected: 5 });
    const tieC = line({ agentId: "c", score: 30, completionPercent: 40, connected: 5, reports: 9 });
    const ranked = rankPerformers([tieC, tieA, tieB]);
    expect(ranked.map((l) => l.agentId)).toEqual(["b", "c", "a"]);
  });

  it("does not mutate the input list", () => {
    const first = line({ agentId: "a", score: 10 });
    const second = line({ agentId: "b", score: 20 });
    const input = [first, second];
    rankPerformers(input);
    expect(input[0].agentId).toBe("a");
  });


  it("prioritises unfinished reports as the clearest gap", () => {
    const insight = performerInsight(line({ reports: 7 }));
    expect(insight.gap).toContain("3টি কল রিপোর্ট বাকি");
    expect(insight.advice).toContain("রিপোর্ট জমা দিন");
  });

  it("gives a concrete call-time action for a low connect rate", () => {
    const insight = performerInsight(line({ connected: 2, connectRate: 20 }));
    expect(insight.gap).toBe("কানেক্ট হার 20%");
    expect(insight.advice).toContain("দুপুর ও সন্ধ্যা");
  });

  it("does not invent a weakness when the metrics are healthy", () => {
    const insight = performerInsight(line());
    expect(insight.gap).toBe("উল্লেখযোগ্য ঘাটতি নেই");
    expect(insight.advice).toContain("এই ছন্দ ধরে রাখুন");
  });

  it("shows the previous day until 9:05 am Dhaka", () => {
    // Dhaka 2026-09-17 03:31 => UTC 2026-09-16 21:31
    const at = new Date(Date.UTC(2026, 8, 16, 21, 31, 0));
    const d = topPerformerDate(at);
    expect(d.dateKey).toBe("2026-09-17");
    expect(d.effectiveDateKey).toBe("2026-09-16");
    expect(d.isPreviousDay).toBe(true);
    expect(d.dayLabel).toBe("গতকের");
    expect(d.revealed).toBe(true); // previous day's 5:30 pm already passed
  });

  it("switches to today at 9:05 am Dhaka", () => {
    // Dhaka 2026-09-17 09:05 => UTC 2026-09-17 03:05
    const at = new Date(Date.UTC(2026, 8, 17, 3, 5, 0));
    const d = topPerformerDate(at);
    expect(d.dateKey).toBe("2026-09-17");
    expect(d.effectiveDateKey).toBe("2026-09-17");
    expect(d.isPreviousDay).toBe(false);
    expect(d.dayLabel).toBe("আজকের");
  });

  it("reveals today's board only after 5:30 pm Dhaka", () => {
    // Dhaka 2026-09-17 17:30 => UTC 2026-09-17 11:30
    const at = new Date(Date.UTC(2026, 8, 17, 11, 30, 0));
    const d = topPerformerDate(at);
    expect(d.effectiveDateKey).toBe("2026-09-17");
    expect(d.revealed).toBe(true);
  });
});