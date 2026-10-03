import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Sales Copilot language switch", () => {
  const s = readFileSync("src/components/crm/sales-intel/SalesIntelPanels.tsx", "utf8");
  it("passes the selected language through mutation variables (no one-step lag)", () => {
    expect(s).toMatch(/mutationFn: \(\{ o, lang \}/);
    expect(s).toMatch(/language: lang/);
    expect(s).toMatch(/rec\.mutate\(\{ o: objection, lang: code \}\)/);
  });
});
