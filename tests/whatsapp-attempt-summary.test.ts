import { describe, expect, it } from "vitest";
import { summarizeWhatsappAttempts } from "@/lib/whatsapp-attempt-summary";
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
});
