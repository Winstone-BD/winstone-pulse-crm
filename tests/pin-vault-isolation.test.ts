import { afterEach, describe, expect, it, vi } from "vitest";
const vault = vi.hoisted(() => ({ vaultPinFor: vi.fn() }));
vi.mock("@/lib/pin-vault.server", () => vault);
import { pinMatchesLive, leadHubPinMatches } from "@/lib/admin-gate.server";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("Nexus PIN isolation", () => {
  it("never accepts the Nexus vault PIN for IT", async () => {
    vi.stubEnv("ADMIN_PIN", "unit-master"); vi.stubEnv("IT_CONSOLE_PIN", "unit-it");
    vault.vaultPinFor.mockImplementation(async (surface: string) => surface === "leadhub" ? "unit-nexus" : "unit-other");
    expect(await pinMatchesLive("unit-nexus")).toBe(false);
    expect(vault.vaultPinFor).not.toHaveBeenCalledWith("leadhub");
  });
  it("still accepts the dedicated Nexus PIN only through its own validator", async () => {
    vi.stubEnv("LEADHUB_PIN", "unit-nexus");
    vault.vaultPinFor.mockResolvedValue("unit-vault-nexus");
    expect(await leadHubPinMatches("unit-vault-nexus")).toBe(true);
    expect(await leadHubPinMatches("unit-it")).toBe(false);
  });
});