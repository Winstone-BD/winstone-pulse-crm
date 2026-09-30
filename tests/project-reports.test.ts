import { describe, expect, it } from "vitest";

import { buildProjectReport, dhakaPeriodBounds } from "../src/lib/project-reports";

const projects = [
  { id: "a", label: "Bashundhara 3 Bed", active: true, sort_order: 1 },
  { id: "b", label: "Purbachal Plot", active: false, sort_order: 2 },
];

describe("Inventory project reports", () => {
  it("uses Dhaka boundaries for a day and month", () => {
    expect(dhakaPeriodBounds("day", "2026-09-30")).toEqual({
      startIso: "2026-09-29T18:00:00.000Z",
      endIso: "2026-09-30T18:00:00.000Z",
    });
    expect(dhakaPeriodBounds("month", "2026-09")).toEqual({
      startIso: "2026-08-31T18:00:00.000Z",
      endIso: "2026-09-30T18:00:00.000Z",
    });
  });

  it("counts explicit facts without inferring unmatched labels", () => {
    const rows = buildProjectReport(
      projects,
      [
        { lead_id: "l1", requirement: " Bashundhara 3 Bed ", category: "closed_converted", customer_response: "site_visit", next_action: null },
        { lead_id: "l1", requirement: "Bashundhara 3 Bed", category: "follow_up", customer_response: null, next_action: "site_visit" },
        { lead_id: "l2", requirement: "Purbachal Plot", category: "follow_up", customer_response: null, next_action: null },
        { lead_id: "l3", requirement: "Unknown", category: "closed_converted", customer_response: "site_visit", next_action: null },
      ],
      new Set(["l1", "l2", "l3"]),
    );
    expect(rows.find((row) => row.projectId === "a")).toMatchObject({ leads: 1, calls: 2, siteVisits: 2, bookings: 1 });
    expect(rows.find((row) => row.projectId === "b")).toMatchObject({ active: false, leads: 1, calls: 1, siteVisits: 0, bookings: 0 });
  });

  it("keeps zero-data Inventory projects visible", () => {
    expect(buildProjectReport(projects, [], new Set()).map((row) => row.calls)).toEqual([0, 0]);
  });
});