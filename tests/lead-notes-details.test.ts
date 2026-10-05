import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { reportFields, reportWhen } from "@/components/crm/ReportDetails";
import { fullDateTime } from "@/lib/crm-format";
import { noteOwnedBy } from "@/lib/lead-notes.functions";

describe("lead details: dates, report description, personal notes", () => {
  it("renders an absolute Dhaka date + time", () => {
    expect(fullDateTime("2026-10-05T03:31:00Z")).toMatch(/05 Oct 2026, 09:31 am/i);
    expect(fullDateTime(null)).toBe("—");
  });
  it("never drops the manual description and labels summary separately", () => {
    const f = reportFields({ note: "আত্মীয়, উত্তরা থাকেন", summary: "দাম জানতে চেয়েছেন", interest: "" });
    expect(f.map((x) => x.label)).toEqual(["বিবরণ / মন্তব্য", "সারসংক্ষেপ"]);
    expect(reportWhen({ submitted_at: "b", created_at: "c" })).toBe("b");
  });
  it("only the author may edit/delete a note", () => {
    expect(noteOwnedBy({ author_profile_id: "a" }, "a", "agent")).toBe(true);
    expect(noteOwnedBy({ author_profile_id: "a" }, "b", "authority")).toBe(false);
    expect(noteOwnedBy({ author_profile_id: null }, null, "authority")).toBe(true);
  });
  it("lead details keep Brief Me plus notes, reports and timeline sections", () => {
    const s = readFileSync("src/components/crm/LeadDossier.tsx", "utf8");
    for (const part of ["PreCallBriefCard", "LeadNotesPanel", "LeadReportsSection", "টাইমলাইন"]) expect(s).toContain(part);
  });
});
