import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* In-memory stand-in for the privileged database client. */
type Row = Record<string, any>;
const store = vi.hoisted(() => ({ tables: {} as Record<string, Row[]> }));

function builder(table: string) {
  const rows = () => (store.tables[table] ??= []);
  const filters: ((r: Row) => boolean)[] = [];
  let op: "select" | "update" | "insert" | "upsert" = "select";
  let patch: Row = {};
  let head = false;
  const run = () => {
    if (op === "insert" || op === "upsert") return [];
    const hit = rows().filter((r) => filters.every((f) => f(r)));
    if (op === "update") hit.forEach((r) => Object.assign(r, patch));
    return hit;
  };
  const b: any = {
    select: (_c?: string, o?: { head?: boolean }) => ((head = !!o?.head), b),
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
    is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), b),
    order: () => b,
    limit: () => b,
    update: (p: Row) => ((op = "update"), (patch = p), b),
    insert: (p: Row) => (rows().push({ ...p }), (op = "insert"), b),
    upsert: (p: Row) => {
      if (!rows().some((r) => r.billing_period === p.billing_period))
        rows().push({ id: `row-${p.billing_period}`, payment_status: "unpaid", unlock_status: "none", unlock_expires_at: null, locked_logged_at: null, ...p });
      op = "upsert";
      return b;
    },
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    single: async () => { const d = run()[0]; return { data: d ?? null, error: d ? null : { message: "none" } }; },
    then: (res: (v: unknown) => void) => { const d = run(); res(head ? { count: d.length, error: null } : { data: d, error: null }); },
  };
  return b;
}
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (t: string) => builder(t) } }));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => undefined }));

const m = await import("@/lib/maintenance.server");
const { deviceLockResponse } = await import("../src/server");

const OCT = "2026-10";
const row = () => store.tables["system_maintenance"]!.find((r) => r.billing_period === OCT)!;
const actions = () => (store.tables["maintenance_audit"] ?? []).map((a) => a.action);

beforeEach(() => {
  store.tables = {};
  m.clearMaintenanceCache();
  vi.useRealTimers();
});

describe("15th at 00:00 Asia/Dhaka", () => {
  it("one second before midnight Dhaka is open, midnight is locked", async () => {
    // 2026-10-14 23:59:59 Dhaka = 17:59:59Z
    expect((await m.maintenanceAccess(new Date("2026-10-14T17:59:59Z"))).locked).toBe(false);
    m.clearMaintenanceCache();
    const s = await m.maintenanceAccess(new Date("2026-10-14T18:00:00Z"));
    expect(s).toMatchObject({ period: OCT, locked: true, stage: "locked", lockAt: "2026-10-14T18:00:00.000Z" });
    expect(actions()).toContain("system_locked");
  });
  it("logs the lock once, not on every check", async () => {
    await m.maintenanceAccess(new Date("2026-10-15T00:00:00Z"));
    m.clearMaintenanceCache();
    await m.maintenanceAccess(new Date("2026-10-15T01:00:00Z"));
    expect(actions().filter((a) => a === "system_locked")).toHaveLength(1);
  });
});

describe("verified payment", () => {
  it("keeps the CRM open after the lock time", async () => {
    await m.maintenanceAccess(new Date("2026-10-01T00:00:00Z"));
    Object.assign(row(), { payment_status: "verified", payment_verified_by: "IT" });
    m.clearMaintenanceCache();
    expect(await m.maintenanceAccess(new Date("2026-10-20T00:00:00Z"))).toMatchObject({ locked: false, stage: "paid" });
  });
  it("pending payment still locks", async () => {
    await m.maintenanceAccess(new Date("2026-10-01T00:00:00Z"));
    row().payment_status = "pending";
    m.clearMaintenanceCache();
    expect((await m.maintenanceAccess(new Date("2026-10-20T00:00:00Z"))).locked).toBe(true);
  });
});

describe("temporary unlock expiry and automatic re-lock", () => {
  it("unlock is active until expiry, then the server expires it and re-locks", async () => {
    await m.maintenanceAccess(new Date("2026-10-15T00:00:00Z"));
    Object.assign(row(), { unlock_status: "approved", unlock_expires_at: "2026-10-15T04:00:00Z" });
    m.clearMaintenanceCache();
    expect(await m.maintenanceAccess(new Date("2026-10-15T03:59:59Z"))).toMatchObject({ locked: false, stage: "unlocked" });
    m.clearMaintenanceCache();
    const after = await m.maintenanceAccess(new Date("2026-10-15T04:00:00Z"));
    expect(after.locked).toBe(true);
    expect(row().unlock_status).toBe("expired");
    expect(actions()).toEqual(expect.arrayContaining(["unlock_expired", "system_relocked"]));
  });
  it("an expired unlock cannot be revived by re-checking", async () => {
    await m.maintenanceAccess(new Date("2026-10-15T00:00:00Z"));
    Object.assign(row(), { unlock_status: "approved", unlock_expires_at: "2026-10-15T01:00:00Z" });
    m.clearMaintenanceCache();
    await m.maintenanceAccess(new Date("2026-10-15T02:00:00Z"));
    m.clearMaintenanceCache();
    expect((await m.maintenanceAccess(new Date("2026-10-15T02:00:00Z"))).locked).toBe(true);
    expect(actions().filter((a) => a === "unlock_expired")).toHaveLength(1);
  });
});

describe("no bypass of the server lock", () => {
  const lockNow = () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T00:00:00Z"));
  };

  it("direct phone API calls get 423 while locked", async () => {
    lockNow();
    const res = await deviceLockResponse(new Request("https://x/api/public/agent/report", { method: "POST", headers: { "x-device-token": "stale-or-forged" } }));
    expect(res?.status).toBe(423);
    expect(await res!.json()).toMatchObject({ code: "maintenance_locked" });
  });

  it("forged client headers/state (unlocked flags, cookies) don't matter", async () => {
    lockNow();
    const res = await deviceLockResponse(new Request("https://x/api/public/ingest/lead", {
      method: "POST",
      headers: { "x-device-token": "t", "x-maintenance-unlocked": "true", cookie: "maintenance=paid; unlocked=1" },
      body: JSON.stringify({ locked: false, paymentStatus: "verified" }),
    }));
    expect(res?.status).toBe(423);
  });

  it("only sign-in, version and config stay reachable for phones", async () => {
    lockNow();
    for (const p of ["/api/public/agent/login", "/api/public/agent/version", "/api/public/config/maintenance"]) {
      expect(await deviceLockResponse(new Request(`https://x${p}`, { headers: { "x-device-token": "t" } }))).toBeNull();
    }
  });

  it("stale session: an unlock that expired after sign-in no longer opens anything", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T00:00:00Z"));
    await m.maintenanceAccess();
    Object.assign(row(), { unlock_status: "approved", unlock_expires_at: "2026-10-15T01:00:00Z" });
    m.clearMaintenanceCache();
    expect(await m.isLockedForOrdinaryUsers()).toBe(false);
    vi.setSystemTime(new Date("2026-10-15T01:00:20Z")); // past expiry and the 15s cache
    expect(await m.isLockedForOrdinaryUsers()).toBe(true);
  });

  it("fails closed when the state can't be read", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const orig = m.maintenanceAccess;
    store.tables = new Proxy({}, { get: () => { throw new Error("db down"); } }) as never;
    expect(await m.isLockedForOrdinaryUsers()).toBe(true);
    spy.mockRestore();
    void orig;
  });
});

describe("one shared state drives every notice", () => {
  const src = readFileSync("src/components/crm/MaintenanceNotice.tsx", "utf8");
  it("badge, profile notice and gate (banner + lock screen) all read useMaintenance", () => {
    for (const name of ["MaintenanceBadge", "MaintenanceProfileNotice", "MaintenanceGate"]) {
      const body = src.slice(src.indexOf(`export function ${name}`)).split("\nexport function")[0]!;
      expect(body).toMatch(/useMaintenance\(\)/);
    }
    expect(src.match(/getMaintenanceStatus\(/g)).toHaveLength(1);
    expect(src).not.toMatch(/localStorage|sessionStorage/);
  });
  it("mounted on Agent profile, Executive HQ and the whole CRM", () => {
    expect(readFileSync("src/components/crm/MyProfileCard.tsx", "utf8")).toMatch(/MaintenanceProfileNotice/);
    expect(readFileSync("src/routes/hq.tsx", "utf8")).toMatch(/MaintenanceProfileNotice/);
    expect(readFileSync("src/routes/__root.tsx", "utf8")).toMatch(/<MaintenanceGate/);
  });
});
