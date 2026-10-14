import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { leadNotAssignedTo, leadHeldByOther } from "@/lib/lead-access.server";
import { checkStagingUrl } from "@/lib/staging-check";

const read = (p: string) => readFileSync(p, "utf8");
const block = (src: string, start: string, len = 1200) => {
  const i = src.indexOf(start);
  expect(i, `missing: ${start}`).toBeGreaterThan(-1);
  return src.slice(i, i + len);
};

describe("lead delivery (held batches)", () => {
  const src = read("src/lib/floor-lock.functions.ts");
  it("re-checks HQ approval at delivery time", () => {
    const fn = block(src, "async function releaseDueGrants");
    expect(fn).toMatch(/state\.approved\.includes\(grant\.employeeId\)/);
    expect(fn).toMatch(/!grant\.deliveredAt/);
  });
  it("signed-out readers never trigger delivery", () => {
    expect(src).toMatch(/caller\.scope === "none" \? stored : await releaseDueGrants\(stored\)/);
  });
});

describe("phone call syncing", () => {
  it("refuses unassigned pool leads and other agents' leads", () => {
    expect(leadNotAssignedTo({ assigned_to: null, assigned_agent_id: null }, "me")).toBe(true);
    expect(leadNotAssignedTo({ assigned_to: "other" }, "me")).toBe(true);
    expect(leadNotAssignedTo({ assigned_agent_id: "other" }, "me")).toBe(true);
    expect(leadNotAssignedTo(null, "me")).toBe(true);
  });
  it("accepts the agent's own lead via either owner column", () => {
    expect(leadNotAssignedTo({ assigned_to: "me" }, "me")).toBe(false);
    expect(leadNotAssignedTo({ assigned_agent_id: "me" }, "me")).toBe(false);
    expect(leadHeldByOther({ assigned_agent_id: "x" }, "me")).toBe(true);
  });
  it("call-state endpoint applies the guard with a 403", () => {
    const src = read("src/routes/api/public/agent/call-state.ts");
    expect(src).toMatch(/leadNotAssignedTo\(lead, caller\.profile\.id\)/);
    expect(block(src, "leadNotAssignedTo(lead", 200)).toMatch(/403/);
  });
});

describe("password-reset links", () => {
  const src = read("src/lib/accounts.functions.ts");
  const fn = block(src, "Exact trusted hosts only", 1600);
  it("only redirects to exact trusted CRM origins, falling back to the main domain", () => {
    expect(fn).toMatch(/"https:\/\/crm\.winstonebd\.com"/);
    expect(fn).toMatch(/allowed\.includes\(origin\) \? origin : allowed\[0\]/);
    expect(fn).toMatch(/redirectTo: `\$\{safeOrigin\}\/reset-password`/);
    expect(fn).not.toMatch(/endsWith\(/);
  });
  it("requires IT/HQ authority and write access before issuing", () => {
    const head = src.slice(src.lastIndexOf("createServerFn", src.indexOf("Exact trusted hosts only")), src.indexOf("Exact trusted hosts only"));
    expect(head).toMatch(/requireAuthority\(caller\)/);
    expect(head).toMatch(/requireWrite\(caller\)/);
  });
});

describe("staging check", () => {
  it("only accepts *.lovable.app staging hosts", () => {
    expect(checkStagingUrl("https://my-copy.lovable.app").ok).toBe(true);
    for (const u of [
      "https://evil.example.com",
      "https://lovable.app.evil.com",
      "https://a.b.lovable.app",
      "https://x.lovable.app.attacker.io",
      "https://169.254.169.254",
      "https://crm.winstonebd.com",
    ])
      expect(checkStagingUrl(u).ok, u).toBe(false);
  });
});

describe("support chat", () => {
  it("starting a conversation requires sign-in", () => {
    const src = read("src/lib/support.functions.ts");
    expect(block(src, "export const startSupportConversation", 200)).toMatch(/\.middleware\(\[requireSupabaseAuth\]\)/);
  });
});

describe("service bill alert page", () => {
  const src = read("src/lib/service-bill-review.functions.ts");
  it("data requires sign-in plus the admin role", () => {
    const fn = block(src, "export const getServiceBillAlert", 300);
    expect(fn).toMatch(/\.middleware\(\[requireSupabaseAuth\]\)/);
    expect(fn).toMatch(/await requireReviewer\(context\)/);
    expect(block(src, "async function requireReviewer", 700)).toMatch(/if \(!email \|\| !isAdmin\) throw/);
  });
  it("page loads client-side only (no server render without a session)", () => {
    expect(read("src/routes/service-bill-alert.tsx")).toMatch(/ssr: false/);
  });
});
