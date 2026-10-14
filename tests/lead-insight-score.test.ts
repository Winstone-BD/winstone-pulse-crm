import { describe, expect, it } from "vitest";
import { reassignNeedsBypass, scoreLead } from "@/lib/lead-insight-score";

const empty = { reports: [], recordings: [], followUpReasons: [] };

describe("lead insight score", () => {
  it("scores zero with no facts and marks AI as not analysed", () => {
    const s = scoreLead(empty);
    expect(s.total).toBe(0);
    expect(s.ai.note).toMatch(/Not analysed/);
    expect(s.highPotential).toBe(false);
  });
  it("caps each part and totals 100 max", () => {
    const s = scoreLead({
      reports: [{ connected: true, duration_seconds: 900, evaluation_answers: { asked_price: true, visit_interest: true, project_interest: true, wanted_info: true, decision_30d: true } }],
      recordings: [{ duration_seconds: 900, sentiment: "positive", ai_intent: "hot buyer", ai_temperature: null }],
      followUpReasons: [],
    });
    expect([s.duration.points, s.engagement.points, s.ai.points, s.total]).toEqual([25, 40, 35, 100]);
  });
  it("visit interest alone flags high potential", () => {
    const s = scoreLead({ ...empty, followUpReasons: ["site_visit"] });
    expect(s.total).toBe(15);
    expect(s.highPotential).toBe(true);
  });
  it("ignores unconnected call duration", () => {
    expect(scoreLead({ ...empty, reports: [{ connected: false, duration_seconds: 600, evaluation_answers: null }] }).duration.points).toBe(0);
  });
  it("requires bypass for upcoming visits or bookings", () => {
    expect(reassignNeedsBypass({ upcomingVisits: 0, activeBookings: 0 })).toBe(false);
    expect(reassignNeedsBypass({ upcomingVisits: 1, activeBookings: 0 })).toBe(true);
    expect(reassignNeedsBypass({ upcomingVisits: 0, activeBookings: 1 })).toBe(true);
  });
});
