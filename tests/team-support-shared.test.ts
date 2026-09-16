import { describe, expect, it } from "vitest";

import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  categoryLabel,
} from "@/lib/team-support-shared";
import { PRIORITY_RANK, type Priority } from "@/lib/support-shared";

describe("team support labels", () => {
  it("labels every priority and status in Bengali", () => {
    for (const p of SUPPORT_PRIORITIES) expect(PRIORITY_LABELS[p]).toBeTruthy();
    for (const s of SUPPORT_STATUSES) expect(STATUS_LABELS[s]).toBeTruthy();
  });

  it("keeps the escalation ladder in order", () => {
    expect(SUPPORT_PRIORITIES).toEqual(["low", "normal", "high", "critical"]);
  });

  it("has unique category keys", () => {
    const keys = SUPPORT_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("falls back to the raw key for an unknown category", () => {
    expect(categoryLabel("crm_problem")).toBe("CRM সমস্যা");
    expect(categoryLabel("does_not_exist")).toBe("does_not_exist");
  });

  it("sorts the customer support desk by urgency first", () => {
    const order: Priority[] = ["normal", "urgent", "low", "high"];
    expect([...order].sort((a, b) => PRIORITY_RANK[a] - PRIORITY_RANK[b])).toEqual([
      "urgent",
      "high",
      "normal",
      "low",
    ]);
  });
});
