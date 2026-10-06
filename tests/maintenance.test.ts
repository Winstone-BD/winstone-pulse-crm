import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  MAINTENANCE_FEE_LABEL,
  clampUnlockMinutes,
  decide,
  defaultLockAt,
  dhakaPeriod,
  isArchitectIdentity,
} from "@/lib/maintenance-rules";

const lockAt = defaultLockAt("2026-10");
const base = { lockAt, paymentStatus: "unpaid" as const, unlockStatus: "none" as const, unlockExpiresAt: null };

describe("maintenance lock rule", () => {
  it("locks at 15th 00:00 Asia/Dhaka", () => {
    expect(lockAt).toBe("2026-10-14T18:00:00.000Z");
    expect(dhakaPeriod(new Date("2026-10-14T18:30:00Z"))).toBe("2026-10");
  });
  it("14th stays active (grace)", () => {
    expect(decide({ ...base, now: new Date("2026-10-14T10:00:00Z") })).toEqual({ locked: false, stage: "due_today" });
  });
  it("15th unpaid locks", () => {
    expect(decide({ ...base, now: new Date("2026-10-14T18:00:01Z") }).locked).toBe(true);
  });
  it("verified stays active", () => {
    expect(decide({ ...base, paymentStatus: "verified", now: new Date("2026-10-20T00:00:00Z") }).locked).toBe(false);
  });
  it("pending payment does not unlock", () => {
    expect(decide({ ...base, paymentStatus: "pending", now: new Date("2026-10-20T00:00:00Z") }).locked).toBe(true);
  });
  it("architect unlock is active until expiry, then relocks", () => {
    const u = { ...base, unlockStatus: "approved" as const, unlockExpiresAt: "2026-10-20T04:00:00Z" };
    expect(decide({ ...u, now: new Date("2026-10-20T03:59:00Z") }).stage).toBe("unlocked");
    expect(decide({ ...u, now: new Date("2026-10-20T04:00:00Z") }).locked).toBe(true);
  });
  it("durations are bounded", () => {
    expect(() => clampUnlockMinutes(25 * 60)).toThrow();
    expect(() => clampUnlockMinutes(5)).toThrow();
    expect(clampUnlockMinutes(240)).toBe(240);
  });
});

describe("architect identity", () => {
  it("accepts only the verified Google account", () => {
    expect(isArchitectIdentity({ email: "zhemon.sm123@gmail.com", emailConfirmed: true, providers: ["google"] })).toBe(true);
    expect(isArchitectIdentity({ email: "zhemon.sm123@gmail.com", emailConfirmed: true, providers: ["email"] })).toBe(false);
    expect(isArchitectIdentity({ email: "someone@gmail.com", emailConfirmed: true, providers: ["google"] })).toBe(false);
    expect(isArchitectIdentity({ email: "zhemon.sm123@gmail.com", emailConfirmed: false, providers: ["google"] })).toBe(false);
  });
});

describe("maintenance wiring", () => {
  const files = [
    "src/lib/maintenance-rules.ts",
    "src/lib/maintenance.server.ts",
    "src/lib/maintenance.functions.ts",
    "src/components/crm/MaintenanceNotice.tsx",
    "src/components/crm/MaintenancePanel.tsx",
    "src/routes/architect.tsx",
  ];
  it("shows only USD, never BDT", () => {
    expect(MAINTENANCE_FEE_LABEL).toBe("$46.29 USD");
    for (const f of files) expect(readFileSync(f, "utf8")).not.toMatch(/BDT|৳|4,?337/);
  });
  it("credential lives only on the server", () => {
    for (const f of ["src/components/crm/MaintenanceNotice.tsx", "src/routes/architect.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/ARCHITECT_UNLOCK_CREDENTIAL|localStorage|sessionStorage/);
    }
  });
  it("resolveCaller and device requests enforce the lock", () => {
    expect(readFileSync("src/lib/access.server.ts", "utf8")).toMatch(/isLockedForOrdinaryUsers/);
    expect(readFileSync("src/server.ts", "utf8")).toMatch(/status: 423/);
  });
  it("audit is append-only and unlock requests are unique per period", () => {
    const sql = readFileSync("drizzle/migrations/0065_maintenance_lock_system.sql", "utf8");
    expect(sql).toMatch(/maintenance_audit_immutable BEFORE UPDATE OR DELETE/);
    expect(sql).toMatch(/maintenance_one_open_request[\s\S]*WHERE status = 'requested'/);
  });
});

describe("notice window", () => {
  it("8th is clear, 9th starts the notice", () => {
    expect(decide({ ...base, now: new Date("2026-10-07T17:59:00Z") }).stage).toBe("clear");
    expect(decide({ ...base, now: new Date("2026-10-08T18:00:00Z") }).stage).toBe("upcoming");
  });
});
