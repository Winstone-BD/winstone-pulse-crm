/**
 * Role access matrix for database records (read + write) per role:
 * signed-out visitor (anon), agent, team_leader, admin.
 *
 * Reads the LIVE policy catalogue read-only via psql (no writes, no role
 * switching). Skips automatically when no database connection is available.
 */
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const hasDb = !!process.env.PGHOST;

function q(sql: string): string[][] {
  const out = execFileSync("psql", ["-At", "-F", "\u001f", "-c", sql], { encoding: "utf8" });
  return out.split("\n").filter(Boolean).map((l) => l.split("\u001f"));
}

type Pol = { table: string; cmd: string; roles: string; qual: string; check: string };
let cache: Pol[] | null = null;
function policies(): Pol[] {
  if (!cache) {
    cache = q(
      `select tablename, cmd, array_to_string(roles,','), coalesce(regexp_replace(qual,'\\s+',' ','g'),''), coalesce(regexp_replace(with_check,'\\s+',' ','g'),'') from pg_policies where schemaname='public'`,
    ).map(([table, cmd, roles, qual, check]) => ({ table, cmd, roles, qual, check }));
  }
  return cache;
}
const pol = (t: string, cmds: string[]) => policies().filter((p) => p.table === t && cmds.includes(p.cmd));
const text = (p: Pol) => `${p.qual} ${p.check}`;
const ownsViaUid = (s: string) => /auth\.uid\(\)/.test(s.replace(/has_role\(auth\.uid\(\), '\w+'::app_role\)/g, ""));

const SENSITIVE = [
  "leads", "call_recordings", "call_reports", "profiles", "user_roles", "follow_up_events",
  "lead_events", "crm_activities", "audit_logs", "service_invoices", "whatsapp_interactions",
  "lead_assignments", "consent_records", "do_not_contact", "bookings", "site_visits",
  "system_maintenance", "pin_vault", "privileged_account_allowlist", "payment_vouchers",
];
const APPEND_ONLY = ["leads", "follow_up_events", "lead_events", "crm_activities", "call_reports", "audit_logs", "lead_assignments"];

describe.skipIf(!hasDb)("database role access matrix", () => {
  it("every public table has row-level security on", () => {
    const off = q(`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`);
    expect(off.map((r) => r[0])).toEqual([]);
  });

  it("signed-out visitors have no table privileges on sensitive records", () => {
    const g = q(`select table_name, privilege_type from information_schema.role_table_grants where table_schema='public' and grantee='anon' and table_name = any(array[${SENSITIVE.map((t) => `'${t}'`).join(",")}])`);
    expect(g).toEqual([]);
    for (const p of policies().filter((p) => SENSITIVE.includes(p.table))) {
      expect(p.roles.split(","), `${p.table} ${p.cmd}`).not.toContain("anon");
      expect(p.roles.split(","), `${p.table} ${p.cmd}`).not.toContain("public");
    }
  });

  it("no sensitive table has an open 'true' rule for signed-in users", () => {
    for (const p of policies().filter((p) => SENSITIVE.includes(p.table))) {
      expect(p.qual.trim(), `${p.table} ${p.cmd} read`).not.toBe("true");
      expect(p.check.trim(), `${p.table} ${p.cmd} write`).not.toBe("true");
    }
  });

  it("agents read/update only their own leads; supervisors see all", () => {
    for (const p of pol("leads", ["SELECT", "UPDATE"])) {
      expect(p.qual).toContain("'admin'::app_role");
      expect(p.qual).toContain("'team_leader'::app_role");
      expect(ownsViaUid(p.qual), "agent path is ownership-bound").toBe(true);
    }
    expect(pol("leads", ["SELECT"]).length).toBeGreaterThan(0);
  });

  it("agents cannot create leads (only admin / team leader)", () => {
    const ins = pol("leads", ["INSERT", "ALL"]);
    expect(ins.length).toBeGreaterThan(0);
    for (const p of ins) expect(ownsViaUid(text(p)), "no agent insert path").toBe(false);
  });

  it("history tables cannot be deleted by anyone from the app", () => {
    for (const t of APPEND_ONLY) {
      const del = pol(t, ["DELETE", "ALL"]).filter((p) => !/^has_role\(auth\.uid\(\), 'admin'::app_role\)$/.test(p.qual.trim()) || t !== "call_recordings");
      expect(del.filter((p) => p.cmd === "DELETE" || p.cmd === "ALL"), t).toEqual([]);
    }
  });

  it("audit logs and lead events are read-only to every role", () => {
    for (const t of ["audit_logs", "lead_events"]) expect(pol(t, ["INSERT", "UPDATE", "DELETE", "ALL"]), t).toEqual([]);
    for (const p of pol("audit_logs", ["SELECT"])) expect(ownsViaUid(p.qual), "agents cannot read audit logs").toBe(false);
  });

  it("roles cannot be self-granted: user_roles is read-own only", () => {
    expect(pol("user_roles", ["INSERT", "UPDATE", "DELETE", "ALL"])).toEqual([]);
    for (const p of pol("user_roles", ["SELECT"])) expect(p.qual.replace(/[()\s]/g, "")).toBe("user_id=auth.uid");
  });

  it("self-created profiles are forced to agent + pending approval", () => {
    const ins = pol("profiles", ["INSERT"]);
    expect(ins.length).toBeGreaterThan(0);
    for (const p of ins) {
      expect(p.check).toContain("user_id = auth.uid()");
      expect(p.check).toContain("'agent'::app_role");
      expect(p.check).toContain("'pending'");
    }
    for (const p of pol("profiles", ["ALL", "UPDATE", "DELETE"])) expect(p.qual.trim()).toBe("has_role(auth.uid(), 'admin'::app_role)");
  });

  it("billing records are invisible to agents and read-only in the app", () => {
    for (const p of pol("service_invoices", ["SELECT"])) expect(ownsViaUid(p.qual)).toBe(false);
    expect(pol("service_invoices", ["INSERT", "UPDATE", "DELETE", "ALL"])).toEqual([]);
    for (const t of ["system_maintenance", "pin_vault", "privileged_account_allowlist", "payment_vouchers"]) {
      expect(pol(t, ["SELECT", "INSERT", "UPDATE", "DELETE", "ALL"]), `${t} server-only`).toEqual([]);
    }
  });

  it("activity entries are written only under the caller's own identity", () => {
    for (const p of pol("crm_activities", ["INSERT"])) expect(p.check).toContain("actor_user_id = auth.uid()");
    expect(pol("crm_activities", ["UPDATE", "DELETE", "ALL"])).toEqual([]);
  });

  it("recordings, calls, follow-ups and WhatsApp are scoped to own/assigned leads for agents", () => {
    for (const t of ["call_recordings", "call_reports", "follow_up_events", "whatsapp_interactions"]) {
      for (const p of pol(t, ["SELECT"])) {
        expect(p.qual, t).toContain("'admin'::app_role");
        expect(ownsViaUid(p.qual), `${t} agent path bound to auth.uid()`).toBe(true);
      }
      for (const p of pol(t, ["ALL"])) expect(p.qual.trim(), `${t} manage = admin only`).toBe("has_role(auth.uid(), 'admin'::app_role)");
    }
  });

  it("only published help articles are public", () => {
    for (const p of pol("support_articles", ["SELECT"]).filter((p) => p.roles.includes("anon"))) {
      expect(p.qual).toContain("'published'");
    }
  });
});
