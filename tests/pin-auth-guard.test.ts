import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), resolveCaller: vi.fn(), pinMatchesLive: vi.fn(), leadHubPinMatches: vi.fn(), mintAdminToken: vi.fn(), getCookie: vi.fn(), setCookie: vi.fn() }));
vi.mock("@tanstack/react-start/server", () => ({ getCookie: mocks.getCookie, setCookie: mocks.setCookie, setResponseHeader: vi.fn() }));
vi.mock("@/lib/access.server", () => ({ resolveCaller: mocks.resolveCaller }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: mocks.rpc } }));
vi.mock("@/lib/admin-gate.server", () => mocks);
import { guardedPinUnlock } from "@/lib/pin-auth.server";
beforeEach(() => {
  vi.clearAllMocks(); process.env["ADMIN_TOKEN_SECRET"] = "unit-only-secret";
  mocks.resolveCaller.mockResolvedValue({ userId: "unit-account" });
  mocks.pinMatchesLive.mockResolvedValue(true); mocks.leadHubPinMatches.mockResolvedValue(true);
  mocks.mintAdminToken.mockReturnValue("unit-token");
});
describe("PIN attempt server boundary", () => {
  it("refuses even a correct PIN while the five-minute block is active", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { allowed: false, retryAfterSeconds: 300 }, error: null });
    expect(await guardedPinUnlock("system", "unit-pin")).toEqual({ ok: false, retryAfterSeconds: 300 });
    expect(mocks.pinMatchesLive).not.toHaveBeenCalled();
    expect(mocks.mintAdminToken).not.toHaveBeenCalled();
  });
  it("resets only through a successful owned attempt before minting a token", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { allowed: true, lease: "unit-lease", retryAfterSeconds: 0 }, error: null });
    mocks.rpc.mockResolvedValueOnce({ data: { accepted: true, retryAfterSeconds: 0 }, error: null });
    expect((await guardedPinUnlock("leadhub", "unit-pin")).ok).toBe(true);
    expect(mocks.rpc).toHaveBeenLastCalledWith("finish_pin_auth_attempt", expect.objectContaining({ _success: true, _lease: "unit-lease", _surface: "leadhub" }));
    expect(mocks.pinMatchesLive).not.toHaveBeenCalled();
    expect(mocks.mintAdminToken).toHaveBeenCalledWith("leadhub");
  });
  it("never mints a token when the attempt lease is not accepted", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { allowed: true, lease: "unit-lease", retryAfterSeconds: 0 }, error: null });
    mocks.rpc.mockResolvedValueOnce({ data: { accepted: false, retryAfterSeconds: 30 }, error: null });
    expect((await guardedPinUnlock("system", "unit-pin")).ok).toBe(false);
    expect(mocks.mintAdminToken).not.toHaveBeenCalled();
  });
});