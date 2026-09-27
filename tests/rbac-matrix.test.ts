import { describe, expect, it } from "vitest";

import { DISPATCH_ROLES, INBOX_ROLES, ROLE_SURFACES, type RoleKey } from "@/lib/rbac";
import { DEFAULT_DAILY_QUOTA, completionPercent, quotaFor } from "@/lib/lead-quota";

describe("role surface matrix", () => {
  it("gives every role a home route", () => {
    for (const [role, surface] of Object.entries(ROLE_SURFACES)) {
      expect(surface.routes[0], role).toBe("/");
      expect(surface.label.length).toBeGreaterThan(0);
    }
  });

  it("never lets the sales team admin reach dispatch or the IT console", () => {
    const admin = ROLE_SURFACES.sales_team_admin;
    expect(admin.routes).not.toContain("/dispatch");
    expect(admin.routes).not.toContain("/system");
    expect(DISPATCH_ROLES).not.toContain("sales_team_admin" as RoleKey);
  });

  it("keeps inbox access wider than dispatch access", () => {
    for (const role of DISPATCH_ROLES) expect(INBOX_ROLES).toContain(role);
    expect(INBOX_ROLES).toContain("sales_team_admin" as RoleKey);
    expect(INBOX_ROLES).not.toContain("agent" as RoleKey);
    expect(INBOX_ROLES).not.toContain("guest" as RoleKey);
  });

  it("gives a guest no powers and no desk", () => {
    expect(ROLE_SURFACES.guest.powers).toHaveLength(0);
    expect(ROLE_SURFACES.guest.routes).not.toContain("/desk");
  });

  it("matches the documented quotas: floor round for all, light desk for Haidar", () => {
    expect(quotaFor("WIN2607", DEFAULT_DAILY_QUOTA)).toBe(5);
    expect(quotaFor("WIN1001", DEFAULT_DAILY_QUOTA)).toBe(25);
    expect(completionPercent(15, 15)).toBe(100);
    expect(completionPercent(25, 25)).toBe(100);
  });
});
