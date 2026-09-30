import { describe, expect, it } from "vitest";

import { EXPORT_TABLES, exportCursorColumn } from "../src/lib/migration-export.functions";

describe("migration export pagination", () => {
  it("uses the distribution ledger's real primary key", () => {
    expect(exportCursorColumn("lead_distribution_runs")).toBe("work_date");
  });

  it("uses id for every other exported table", () => {
    for (const table of EXPORT_TABLES) {
      if (table === "lead_distribution_runs") continue;
      expect(exportCursorColumn(table)).toBe("id");
    }
  });
});