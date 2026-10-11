import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DeskTabBar } from "@/components/crm/desk/DeskTabBar";

describe("desk navigation and honest SIM workspace", () => {
  it("keeps all eight sections reachable without horizontal scrolling", () => {
    const html = renderToStaticMarkup(React.createElement(DeskTabBar, { tab: "calls", onChange: () => {} }));
    expect(html.match(/<button/g)).toHaveLength(9);
    expect(html).toContain("grid-cols-2");
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain("overflow-x-auto");
    for (const tone of ["text-chart-2", "text-success", "text-chart-4", "text-destructive"]) expect(html).toContain(tone);
  });
  it("reuses authorised note and report panels before and during calls", () => {
    const source = readFileSync("src/components/crm/WebCallButton.tsx", "utf8");
    expect(source.match(/<CallLeadContext leadId={leadId}/g)).toHaveLength(2);
    expect(source).toContain("Mute · on phone");
    expect(source).toContain("Call has ended · open report");
    const context = readFileSync("src/components/crm/CallLeadContext.tsx", "utf8");
    expect(context).toContain("<LeadNotesPanel");
    expect(context).toContain("<LeadReportsSection");
    expect(context).toContain("buildTimeline");
  });
});