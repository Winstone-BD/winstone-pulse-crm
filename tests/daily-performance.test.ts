import { describe, expect, it } from "vitest";

import {
  dailyPerformanceOf,
  dhakaDateKey,
  dhakaDayWindow,
  floorTotals,
  type CallReportEvent,
  type FollowUpEvent,
} from "@/lib/daily-performance";

const DAY = "2026-09-20";
const AGENT = "agent-1";
const OTHER = "agent-2";

const workload = (over: Partial<Parameters<typeof dailyPerformanceOf>[0]["workload"]> = {}) => ({
  leadsAssigned: 30,
  carriedOverPending: 0,
  newFromDatabase: 30,
  reassignedIn: 0,
  reassignedOut: 0,
  excessPending: 0,
  target: 30,
  ...over,
});

const report = (over: Partial<CallReportEvent> = {}): CallReportEvent => ({
  id: crypto.randomUUID(),
  leadId: "lead-1",
  agentId: AGENT,
  status: "submitted",
  connected: true,
  durationSeconds: 120,
  category: "interested",
  at: `${DAY}T11:00:00+06:00`,
  ...over,
});

const followUp = (over: Partial<FollowUpEvent> = {}): FollowUpEvent => ({
  id: crypto.randomUUID(),
  leadId: "lead-1",
  agentId: AGENT,
  category: "follow_up",
  status: "completed",
  scheduledAt: `${DAY}T10:00:00+06:00`,
  completedAt: `${DAY}T12:00:00+06:00`,
  createdAt: `${DAY}T09:00:00+06:00`,
  ...over,
});

const day = (reports: CallReportEvent[] = [], followUps: FollowUpEvent[] = [], load = workload()) =>
  dailyPerformanceOf({ agentId: AGENT, dateKey: DAY, reports, followUps, workload: load });

describe("আজকের কাজের হিসাব (একটিই সার্ভার নিয়ম)", () => {
  it("ব্যবসার দিন সবসময় ঢাকার সময়ে, ডিভাইসের সময়ে নয়", () => {
    // ঢাকায় ২০ তারিখ রাত ১২:৩০ = UTC-তে ১৯ তারিখ সন্ধ্যা
    expect(dhakaDateKey(new Date("2026-09-19T18:30:00Z"))).toBe("2026-09-20");
    expect(dhakaDateKey(new Date("2026-09-19T17:30:00Z"))).toBe("2026-09-19");
    const window = dhakaDayWindow(DAY);
    expect(window.start).toBe("2026-09-19T18:00:00.000Z");
    expect(window.end).toBe("2026-09-20T18:00:00.000Z");
  });

  it("লিড হাতে থাকা মানে কাজ নয় — ৩০টি লিড পেলেও কল ০", () => {
    const row = day();
    expect(row.leadsAssigned).toBe(30);
    expect(row.callsAttempted).toBe(0);
    expect(row.activityPercent).toBe(0);
  });

  it("শুধু জমা দেওয়া রিপোর্টই কল হিসেবে গোনা হয়", () => {
    const row = day([report(), report({ status: "pending" }), report({ status: "draft" })]);
    expect(row.callsAttempted).toBe(1);
  });

  it("ধরা হয়নি এমন কল সংযোগ বাড়ায় না, কথা বলার সময়ও বাড়ে না", () => {
    const row = day([report({ connected: false, durationSeconds: 0, category: "no_answer" })]);
    expect(row.callsAttempted).toBe(1);
    expect(row.connectedCalls).toBe(0);
    expect(row.talkMinutes).toBe(0);
    expect(row.connectRate).toBe(0);
  });

  it("একই লিডে দুইবার কল করলেও সম্ভাবনাময়/বুকিং একবারই গোনা হয়", () => {
    const row = day([
      report({ leadId: "lead-9", category: "closed_converted" }),
      report({ leadId: "lead-9", category: "closed_converted" }),
    ]);
    expect(row.callsAttempted).toBe(2);
    expect(row.bookings).toBe(1);
    expect(row.qualifiedLeads).toBe(1);
  });

  it("একই রিপোর্ট দুইবার এলে (রিফ্রেশ/ক্রন/ওয়েব+অ্যাপ) দুইবার গোনা হয় না", () => {
    const one = report({ id: "r-1" });
    const row = day([one, { ...one }]);
    expect(row.callsAttempted).toBe(1);
  });

  it("অন্য এজেন্টের কাজ এই এজেন্টের হিসাবে আসে না", () => {
    const row = day([report({ agentId: OTHER })]);
    expect(row.callsAttempted).toBe(0);
  });

  it("লিড হাতবদল হলে কাজের কৃতিত্ব দুইবার হয় না — যে কল করেছে সে-ই পায়", () => {
    const shared = [
      report({ id: "r-a", agentId: OTHER, leadId: "lead-5", category: "interested" }),
      report({ id: "r-b", agentId: AGENT, leadId: "lead-5", category: "closed_converted" }),
    ];
    const mine = day(shared, [], workload({ reassignedIn: 1 }));
    const theirs = dailyPerformanceOf({
      agentId: OTHER,
      dateKey: DAY,
      reports: shared,
      followUps: [],
      workload: workload({ reassignedOut: 1 }),
    });
    expect(mine.callsAttempted).toBe(1);
    expect(theirs.callsAttempted).toBe(1);
    expect(mine.bookings + theirs.bookings).toBe(1);
  });

  it("আগের বা পরের দিনের কাজ আজকের হিসাবে ঢোকে না (মধ্যরাতের সীমা)", () => {
    const row = day([
      report({ at: `${DAY}T00:05:00+06:00` }),
      report({ at: "2026-09-19T23:55:00+06:00" }),
      report({ at: "2026-09-21T00:05:00+06:00" }),
    ]);
    expect(row.callsAttempted).toBe(1);
  });

  it("শেষ হওয়া ফলো-আপই গোনা হয়, বাতিল বা অপেক্ষমাণ নয়", () => {
    const row = day([], [
      followUp(),
      followUp({ status: "cancelled", completedAt: `${DAY}T12:00:00+06:00` }),
      followUp({ status: "pending", completedAt: null }),
    ]);
    expect(row.followUpsCompleted).toBe(1);
    expect(row.followUpsDue).toBe(1);
  });

  it("সাইট ভিজিট নির্ধারিত ও সম্পন্ন আলাদা, বাতিল ভিজিট গোনা হয় না", () => {
    const row = day([], [
      followUp({ category: "site_visit", status: "pending", completedAt: null }),
      followUp({ category: "site_visit", status: "completed" }),
      followUp({ category: "site_visit", status: "cancelled" }),
    ]);
    expect(row.siteVisitsScheduled).toBe(2);
    expect(row.siteVisitsCompleted).toBe(1);
  });

  it("বুকিং বাতিল হলে (রিপোর্ট বাতিল/খসড়া) বুকিং গোনা হয় না", () => {
    const row = day([report({ category: "closed_converted", status: "cancelled" })]);
    expect(row.bookings).toBe(0);
  });

  it("লক্ষ্য পূরণ আর আসল কাজ আলাদা — ৩০ লিডে ১০ কল মানে ৩৩%", () => {
    const row = day(Array.from({ length: 10 }, (_, i) => report({ id: `r-${i}`, leadId: `l-${i}` })));
    expect(row.target).toBe(30);
    expect(row.callsAttempted).toBe(10);
    expect(row.activityPercent).toBe(33);
  });

  it("অতিরিক্ত পেন্ডিং হিসাবে থাকে, কাজ হিসেবে নয়", () => {
    const row = day([], [], workload({ excessPending: 17, leadsAssigned: 47 }));
    expect(row.excessPending).toBe(17);
    expect(row.callsAttempted).toBe(0);
  });

  it("কোনো তথ্য না থাকলে সব শূন্য — বানানো সংখ্যা নয়", () => {
    const row = day([], [], workload({ leadsAssigned: 0, newFromDatabase: 0, target: 0 }));
    expect(row.activityPercent).toBe(0);
    expect(row.connectRate).toBe(0);
    expect(row.conversionRate).toBe(0);
  });

  it("ফ্লোরের মোট একই সারি থেকে যোগ হয়, আলাদা করে গোনা হয় না", () => {
    const mine = day([report({ id: "x", category: "closed_converted" })]);
    const totals = floorTotals([mine, mine]);
    expect(totals.callsAttempted).toBe(2);
    expect(totals.bookings).toBe(2);
    expect(totals.conversionRate).toBe(100);
  });
});
