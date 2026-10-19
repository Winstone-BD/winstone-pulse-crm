import { describe, expect, it } from "vitest";
import { summarizeWhatsappAttempts, whatsappSummaryCsv } from "@/lib/whatsapp-attempt-summary";
import { filterWhatsappAttempts } from "@/lib/whatsapp-attempt-filters";
describe("WhatsApp agent summary", () => {
  it("counts submitted and pending reports per agent, prioritising pending work", () => {
    expect(summarizeWhatsappAttempts([
      { agentName: "A", submitted: true, startedAt: "2026-10-19T00:00:00Z" },
      { agentName: "A", submitted: false, startedAt: "2026-10-19T01:00:00Z" },
      { agentName: "B", submitted: true, startedAt: "2026-10-19T02:00:00Z" },
    ])).toEqual([
      { agentName: "A", attempts: 2, submitted: 1, pending: 1, lastAttemptAt: "2026-10-19T01:00:00Z" },
      { agentName: "B", attempts: 1, submitted: 1, pending: 0, lastAttemptAt: "2026-10-19T02:00:00Z" },
    ]);
  });
  it("retains unknown agents and handles no attempts", () => {
    expect(summarizeWhatsappAttempts([])).toEqual([]);
    expect(summarizeWhatsappAttempts([{ agentName: null, submitted: false, startedAt: "2026-10-19T00:00:00Z" }])[0]).toMatchObject({ agentName: null, attempts: 1, pending: 1, submitted: 0 });
  });
  it("summarizes only attempts inside the inclusive Dhaka date range", () => {
    const attempts = [
      { agentName: "A", submitted: false, startedAt: "2026-10-18T17:59:59Z" },
      { agentName: "A", submitted: true, startedAt: "2026-10-18T18:00:00Z" },
      { agentName: "A", submitted: false, startedAt: "2026-10-20T17:59:59Z" },
      { agentName: "B", submitted: true, startedAt: "2026-10-20T18:00:00Z" },
    ];
    const rows = filterWhatsappAttempts(attempts, { from: "2026-10-19", to: "2026-10-20", agent: "", status: "all" });
    expect(summarizeWhatsappAttempts(rows)).toEqual([{ agentName: "A", attempts: 2, submitted: 1, pending: 1, lastAttemptAt: "2026-10-20T17:59:59Z" }]);
  });
  it("exports displayed totals, Dhaka timestamp and selected dates", () => {
    const csv = whatsappSummaryCsv(summarizeWhatsappAttempts([{ agentName: "এজেন্ট", submitted: true, startedAt: "2026-10-18T18:00:00Z" }]), "2026-10-19", "2026-10-20");
    expect(csv).toContain('"এজেন্ট","1","1","0","2026-10-19T00:00:00.000+06:00","2026-10-19","2026-10-20"');
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });
  it("neutralizes spreadsheet formulas and escapes quoted agent names", () => {
    const csv = whatsappSummaryCsv(summarizeWhatsappAttempts([{ agentName: '=HYPERLINK("x")', submitted: false, startedAt: "2026-10-19T00:00:00Z" }]), "", "");
    expect(csv).toContain('"\'=HYPERLINK(""x"")"');
  });
});
