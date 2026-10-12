import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { isArchitectIdentity } from "@/lib/maintenance-rules";

const fns = readFileSync("src/lib/maintenance.functions.ts", "utf8");
const block = (name: string) => {
  const start = fns.indexOf(`export const ${name}`);
  const next = fns.indexOf("export const", start + 10);
  return fns.slice(start, next === -1 ? undefined : next);
};

describe("IT cannot approve payments or unlock by itself", () => {
  it("IT actions only submit, never verify or approve", () => {
    for (const n of ["submitMaintenancePayment", "withdrawMaintenancePayment", "requestSystemUnlock", "itMaintenance"]) {
      const b = block(n);
      expect(b, n).toMatch(/itCaller/);
      expect(b, n).not.toMatch(/architectReviewPayment|architectDecide/);
    }
  });
  it("payment approval and unlock require the architect session", () => {
    for (const n of ["architectPaymentDecision", "architectDecision", "architectOverview"]) {
      expect(block(n), n).toMatch(/await architect\(data\.session\)/);
    }
    expect(fns.match(/architectReviewPayment\(/g)).toHaveLength(1);
    expect(fns.match(/architectDecide\(/g)).toHaveLength(1);
  });
  it("architect login needs the allowed Google account, then the server PIN", () => {
    const b = block("architectLogin");
    expect(b).toMatch(/architectFromRequest/);
    expect(b).toMatch(/credentialMatches/);
    expect(b).toMatch(/recentFailures\(\)\) >= 5/);
    expect(isArchitectIdentity({ email: "zhemongrowth@gmail.com", emailConfirmed: true, providers: ["google"] })).toBe(true);
    expect(isArchitectIdentity({ email: "it@winstonebd.com", emailConfirmed: true, providers: ["google"] })).toBe(false);
  });
  it("the hidden /tech page is not indexed and holds no PIN", () => {
    const page = readFileSync("src/routes/tech.tsx", "utf8");
    expect(page).toMatch(/createFileRoute\("\/tech"\)/);
    expect(page).toMatch(/noindex, nofollow/);
    expect(page).not.toMatch(/142164|ARCHITECT_UNLOCK_CREDENTIAL/);
  });
});
