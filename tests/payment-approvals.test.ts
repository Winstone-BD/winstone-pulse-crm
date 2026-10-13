import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { isArchitectIdentity } from "@/lib/maintenance-rules";

const server = readFileSync("src/lib/maintenance.server.ts", "utf8");
const fns = readFileSync("src/lib/maintenance.functions.ts", "utf8");
const ui = readFileSync("src/components/crm/PaymentApprovals.tsx", "utf8");
const review = server.slice(server.indexOf("export async function architectReviewPayment"), server.indexOf("export async function setLockAt"));
const decision = fns.slice(fns.indexOf("export const architectPaymentDecision"), fns.indexOf("/* ---------------- IT Console actions"));

describe("Payment approvals — architect only", () => {
  it("architect identity passes; Super Admin and others are denied", () => {
    expect(isArchitectIdentity({ email: "zhemongrowth@gmail.com", emailConfirmed: true, providers: ["google"] })).toBe(true);
    expect(isArchitectIdentity({ email: "trendfluxos@gmail.com", emailConfirmed: true, providers: ["google"] })).toBe(false);
    expect(isArchitectIdentity({ email: "zhemongrowth@gmail.com", emailConfirmed: true, providers: ["email"] })).toBe(false);
    expect(isArchitectIdentity({ email: "zhemongrowth@gmail.com", emailConfirmed: false, providers: ["google"] })).toBe(false);
  });

  it("direct requests must pass the server identity + PIN session check, never client role/email", () => {
    expect(decision).toMatch(/await architect\(data\.session\)/);
    expect(decision).not.toMatch(/data\.(email|role)/);
    expect(fns).toMatch(/architectFromRequest\(\);\s*if \(!who \|\| !m\.architectSessionValid/);
  });

  it("approve and reject both need an audit reason and record who decided", () => {
    expect(decision).toMatch(/reason: z\.string\(\)\.trim\(\)\.min\(3\)/);
    expect(review).toMatch(/action: input\.approve \? "payment_verified" : "payment_rejected"/);
    expect(review).toMatch(/approving_account: input\.actor/);
    expect(review).toMatch(/payment_rejected_reason: input\.reason/);
  });

  it("duplicate or concurrent decisions cannot apply twice", () => {
    expect(review).toMatch(/\.eq\("payment_status", "pending"\)\.eq\("payment_ref", row\.payment_ref\)\.select/);
    expect(review).toMatch(/changed\.length === 0\) throw new Error\("Already decided/);
    expect(review).toMatch(/expectedRef !== row\.payment_ref/);
  });

  it("UI confirms before acting, blocks double clicks and holds no secrets", () => {
    expect(ui).toMatch(/AlertDialog/);
    expect(ui).toMatch(/inflight\.current/);
    expect(ui).toMatch(/expectedRef: period\.payment_ref/);
    expect(ui).not.toMatch(/142164|ARCHITECT_UNLOCK_CREDENTIAL|password/i);
  });
});
