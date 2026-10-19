import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { computeCommandCenter, presetRange } from "@/lib/command-center";

vi.mock("@/lib/crm-data", () => ({ CONNECTED_THRESHOLD_SECONDS: 10 }));
import { ExecutiveKpiBoard } from "@/components/crm/hq/ExecutiveKpiBoard";

const now = new Date("2026-10-19T00:29:00Z");
const metrics = computeCommandCenter({ leads: [], calls: [], reports: [], followUps: [], agents: [], filters: { ...presetRange("7d", now), agentId: null, source: null, project: null }, now, dailyLeadQuota: 50 });

describe("executive board missing inputs", () => {
  it("does not throw when a stale caller omits metrics", () => {
    expect(() => renderToStaticMarkup(createElement(ExecutiveKpiBoard, { profiles: [], leads: [], calls: [], messages: [], period: "" }))).not.toThrow();
  });
  it("does not throw when WhatsApp data has not arrived", () => {
    expect(() => renderToStaticMarkup(createElement(ExecutiveKpiBoard, { profiles: [], leads: [], calls: [], metrics, period: "" }))).not.toThrow();
  });
  it("does not throw on null snapshot arrays during refresh", () => {
    expect(() => renderToStaticMarkup(createElement(ExecutiveKpiBoard, { profiles: null, leads: null, calls: null, messages: null, metrics, period: "" }))).not.toThrow();
  });
});