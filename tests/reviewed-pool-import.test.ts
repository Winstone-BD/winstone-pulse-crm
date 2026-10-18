import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  let validate = (data: unknown) => data;
  const api = { inputValidator(fn: (data: unknown) => unknown) { validate = fn; return api; }, handler(fn: (args: { data: unknown }) => unknown) { return (args: { data: unknown }) => fn({ data: validate(args.data) }); } };
  return api;
} }));
const gate = vi.fn();
const intake = vi.fn();
vi.mock("@/lib/access.server", () => ({ requireLeadHub: (token: unknown) => gate(token) }));
vi.mock("@/lib/lead-intake.server", () => ({ intakeLead: (input: unknown) => intake(input), normalizeLeadPhone: (phone: string) => phone.replace(/^0/, "880") }));
beforeEach(() => { gate.mockReset(); intake.mockReset(); });
it("requires LeadHub authority before any import", async () => {
  gate.mockRejectedValue(new Error("LeadHub PIN required"));
  const { importReviewedPoolLeads } = await import("../src/lib/lead-import.functions");
  await expect(importReviewedPoolLeads({ data: { adminToken: null, rows: [{ name: "Buyer", phoneNumber: "01712345678" }] } })).rejects.toThrow("LeadHub PIN required");
  expect(intake).not.toHaveBeenCalled();
});
it("reviewed rows stay unassigned and duplicates preserve canonical ownership", async () => {
  gate.mockResolvedValue(undefined);
  intake.mockResolvedValueOnce({ duplicate: false }).mockResolvedValueOnce({ duplicate: true });
  const { importReviewedPoolLeads } = await import("../src/lib/lead-import.functions");
  const result = await importReviewedPoolLeads({ data: { adminToken: "fixture", rows: [{ name: "Buyer", phoneNumber: "01712345678" }, { name: "Existing", phoneNumber: "01812345678" }] } });
  expect(result).toEqual({ added: 1, duplicate: 1, failed: [] });
  expect(intake).toHaveBeenCalledWith(expect.objectContaining({ ownerId: null, source: "head_database" }));
});
it("CSV extraction works without AI or title-based mapping and never saves", async () => {
  gate.mockResolvedValue(undefined);
  const { parseLeadFile } = await import("../src/lib/lead-import.functions");
  const result = await parseLeadFile({ data: { adminToken: "fixture", fileName: "anything", mimeType: "application/octet-stream", dataBase64: btoa("name,phone\nBuyer,01712345678\nDuplicate,01712345678") } });
  expect(result.rows).toHaveLength(1);
  expect(result.rows[0]?.phoneNumber).toBe("8801712345678");
  expect(result.skipped).toBe(1);
  expect(intake).not.toHaveBeenCalled();
});