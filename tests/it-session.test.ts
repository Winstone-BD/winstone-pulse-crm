import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { adminTokenScope, itAccountTokenUser, itChallengeValid, mintItAccountToken, mintItChallenge } from "@/lib/admin-gate.server";

beforeEach(() => { process.env["ADMIN_TOKEN_SECRET"] = "test-only-secret"; vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());
describe("IT sequential access", () => {
  it("expires PIN challenge in ten minutes and account session in eight hours", () => {
    const challenge = mintItChallenge();
    const token = mintItAccountToken("staff-id");
    expect(adminTokenScope(challenge)).toBeNull();
    vi.advanceTimersByTime(10 * 60_000);
    expect(itChallengeValid(challenge)).toBe(false);
    expect(itAccountTokenUser(token)).toBe("staff-id");
    vi.advanceTimersByTime(8 * 60 * 60_000);
    expect(itAccountTokenUser(token)).toBeNull();
  });
  it("requires identified role and audit before issuing the account token", () => {
    const source = readFileSync("src/lib/it-access.functions.ts", "utf8");
    expect(source).toContain(".middleware([requireSupabaseAuth])");
    expect(source).toContain('rpc("has_role"');
    expect(source.indexOf("if (auditError)")).toBeLessThan(source.indexOf("gate.mintItAccountToken"));
    const access = readFileSync("src/lib/access.server.ts", "utf8");
    expect(access).toContain("gate.itAccountTokenUser(adminToken) !== userId");
  });
  it("awaits every legacy IT guard call", () => {
    for (const name of ["config", "ingest", "copilot", "payments", "pin-vault", "crm"]) {
      const source = readFileSync(`src/lib/${name}.functions.ts`, "utf8");
      expect(source).not.toMatch(/(?<!await )requireAdminToken\(data\.adminToken\);/);
    }
  });
});