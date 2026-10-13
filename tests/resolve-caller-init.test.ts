import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";

// No live request in tests: resolveCaller must still initialise and answer.
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => undefined }));
const lock = vi.hoisted(() => ({ locked: false }));
vi.mock("@/lib/maintenance.server", () => ({
  isLockedForOrdinaryUsers: async () => lock.locked,
  LOCKED_MESSAGE: "SYSTEM MAINTENANCE LOCKED",
}));

beforeAll(() => {
  process.env["ADMIN_TOKEN_SECRET"] = "test-secret";
});

describe("resolveCaller module initialisation (regression)", () => {
  it("access.server loads the PIN gate lazily, never as a static import", () => {
    const source = readFileSync("src/lib/access.server.ts", "utf8");
    // A static value import was the binding that hit
    // "Cannot access '__vite_ssr_import_2__' before initialization".
    expect(source).not.toMatch(/^import\s+\{[^}]*\badminTokenScope\b[^}]*\}\s+from\s+"@\/lib\/admin-gate\.server"/m);
    expect(source).toMatch(/await import\("@\/lib\/admin-gate\.server"\)/);
  });

  it("works when called right after import, the way getMyAccount calls it", async () => {
    const [{ resolveCaller }, gate] = await Promise.all([
      import("@/lib/access.server"),
      import("@/lib/admin-gate.server"),
    ]);

    await expect(resolveCaller(null)).resolves.toMatchObject({ scope: "none", userId: null });
    await expect(resolveCaller(gate.mintAdminToken("full"))).resolves.toMatchObject({
      scope: "none",
      readOnly: true,
    });
    await expect(resolveCaller(gate.mintAdminToken("hq"))).resolves.toMatchObject({
      scope: "authority",
      readOnly: true,
    });
    // LeadHub tokens never grant HQ/IT authority.
    await expect(resolveCaller(gate.mintAdminToken("leadhub"))).resolves.toMatchObject({
      scope: "none",
    });
  });

  it("survives repeated concurrent calls without an initialisation error", async () => {
    const { resolveCaller } = await import("@/lib/access.server");
    const results = await Promise.all(Array.from({ length: 10 }, () => resolveCaller(null)));
    expect(results.every((r) => r.scope === "none")).toBe(true);
  });

  it("maintenance lock blocks HQ and PIN alone cannot grant IT recovery authority", async () => {
    const [{ resolveCaller }, gate] = await Promise.all([
      import("@/lib/access.server"),
      import("@/lib/admin-gate.server"),
    ]);
    lock.locked = true;
    await expect(resolveCaller(gate.mintAdminToken("hq"))).rejects.toThrow(/MAINTENANCE LOCKED/);
    await expect(resolveCaller(gate.mintAdminToken("full"))).resolves.toMatchObject({ scope: "none" });
    await expect(resolveCaller(gate.mintItAccountToken("test-user"))).resolves.toMatchObject({ scope: "none" });
    await expect(resolveCaller(gate.mintAdminToken("hq"), { skipMaintenance: true })).resolves.toMatchObject({ readOnly: true });
    lock.locked = false;
  });
});
