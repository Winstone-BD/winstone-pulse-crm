import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");

describe("public self-registration is retired", () => {
  it("homepage has no sign-up form, route or button", () => {
    const home = read("src/routes/index.tsx");
    expect(home).not.toMatch(/HomeSignupForm/);
    expect(home).not.toMatch(/mode:\s*"signup"/);
    expect(home).not.toMatch(/Create account/);
    expect(home).toMatch(/Are you a Winstone sales agent\?/);
    expect(home).toMatch(/New agent accounts are created and managed by Winstone IT HQ\./);
    expect(existsSync("src/components/HomeSignupForm.tsx")).toBe(false);
  });

  it("auth page only signs in and never calls signUp", () => {
    const auth = read("src/routes/auth.tsx");
    expect(auth).not.toMatch(/auth\.signUp\(/);
    expect(auth).toMatch(/mode: z\.literal\("signin"\)/);
    expect(auth).toMatch(/signInWithIdentifier/);
    expect(auth).toMatch(/navigate\(\{ to: "\/desk" \}\)/);
  });

  it("no browser code creates auth accounts", () => {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const hits = execSync("rg -l 'auth\\.signUp\\(' src || true").toString().trim();
    expect(hits).toBe("");
  });

  it("IT Console provisioning stays authority + write gated", () => {
    const src = read("src/lib/accounts.functions.ts");
    const fn = src.slice(src.indexOf("export const createStaffAccount"));
    expect(fn).toMatch(/requireAuthority\(caller\)/);
    expect(fn).toMatch(/requireWrite\(caller\)/);
    expect(fn).toMatch(/auth\.admin\.createUser/);
  });

  it("agents never reach IT/admin surfaces", () => {
    const gate = read("src/components/crm/RoleGate.tsx");
    expect(gate).toMatch(/itAuthenticated/);
    const access = read("src/lib/access.server.ts");
    expect(access).toMatch(/isAdmin \? "authority" : "agent"/);
  });
});
