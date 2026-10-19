import { describe, expect, it } from "vitest";
import { filterWhatsappAttempts, whatsappAttemptsCsv, type AttemptRow } from "@/lib/whatsapp-attempt-filters";
const rows: AttemptRow[] = [
  { id: "1", agentName: "A", startedAt: "2026-10-18T18:00:00Z", submitted: true, leadName: "=CMD()", phoneNumber: "+8801", typedSeconds: 65, submittedAt: "2026-10-19T00:00:00Z" },
  { id: "2", agentName: "B", startedAt: "2026-10-18T17:59:59Z", submitted: false, leadName: 'Lead "B"', phoneNumber: null, typedSeconds: null, submittedAt: null },
];
const all = { from: "", to: "", agent: "", status: "all" as const };
describe("WhatsApp attempt filters and export", () => {
  it("uses inclusive Dhaka dates", () => expect(filterWhatsappAttempts(rows, { ...all, from: "2026-10-19", to: "2026-10-19" }).map(r => r.id)).toEqual(["1"]));
  it("filters by agent", () => expect(filterWhatsappAttempts(rows, { ...all, agent: "B" }).map(r => r.id)).toEqual(["2"]));
  it("filters submitted reports", () => expect(filterWhatsappAttempts(rows, { ...all, status: "submitted" }).map(r => r.id)).toEqual(["1"]));
  it("filters pending reports", () => expect(filterWhatsappAttempts(rows, { ...all, status: "pending" }).map(r => r.id)).toEqual(["2"]));
  it("combines all filters and excludes out-of-range rows", () => expect(filterWhatsappAttempts(rows, { from: "2026-10-19", to: "2026-10-19", agent: "B", status: "pending" })).toEqual([]));
  it("exports only filtered rows, with formula neutralisation", () => {
    const csv = whatsappAttemptsCsv(filterWhatsappAttempts(rows, { ...all, agent: "A" }));
    expect(csv).toContain('"\'=CMD()"'); expect(csv).toContain('"\'+8801"'); expect(csv).not.toContain('Lead ""B""'); expect(csv).toContain("+06:00");
  });
  it("quotes embedded commas and quotes", () => expect(whatsappAttemptsCsv([{ ...rows[0], leadName: 'A, "B"' }])).toContain('"A, ""B"""'));
});