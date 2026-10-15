/**
 * Production-readiness guards (read-only).
 * - Every public table has RLS and anon holds no table grants (live catalogue; skips without DB).
 * - Recent AI/marketing server functions resolve the caller and scope agents to their own leads.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hasDb = !!process.env.PGHOST;
const q = (sql: string) => execFileSync("psql", ["-At", "-c", sql], { encoding: "utf8" }).trim();
const src = (p: string) => readFileSync(p, "utf8");

describe.skipIf(!hasDb)("database lockdown", () => {
  it("has no public table without RLS", () => {
    expect(q("select count(*) from pg_tables where schemaname='public' and not rowsecurity")).toBe("0");
  });
  it("grants anon nothing on public tables", () => {
    expect(
      q("select count(*) from information_schema.role_table_grants where table_schema='public' and grantee='anon'"),
    ).toBe("0");
  });
});

describe("AI and marketing server functions are caller-scoped", () => {
  const files = [
    "src/lib/buyer-extract.functions.ts",
    "src/lib/buyer-facts.functions.ts",
    "src/lib/sales-drafts.functions.ts",
  ];
  for (const f of files) {
    it(`${f} resolves the caller before work`, () => {
      const s = src(f);
      const fns = s.split("createServerFn").length - 1;
      expect(fns).toBeGreaterThan(0);
      expect(s).toMatch(/resolveCaller/);
      expect(s).toMatch(/Sign in required/);
    });
  }
  it("buyer facts refuse leads not assigned to the agent", () => {
    expect(src("src/lib/buyer-facts.functions.ts")).toMatch(/assigned_to !== c\.profile!\.id/);
  });
  it("every sales-draft handler calls scope()", () => {
    const s = src("src/lib/sales-drafts.functions.ts");
    const handlers = s.split(".handler(").slice(1);
    for (const h of handlers) expect(h.slice(0, 200)).toMatch(/scope\(data\.token\)/);
  });
});
