import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { matchesStage } from "@/components/crm/LeadQuickFilter";
import { PIPELINE_STAGES } from "@/lib/crm-data";

const lead = (stage: string) => ({ pipeline_stage: stage }) as never;

describe("pipeline stage filter", () => {
  it("passes every lead when stage is all", () => {
    for (const s of PIPELINE_STAGES) {
      expect(matchesStage(lead(s.key), "all")).toBe(true);
    }
  });

  it("matches exactly the selected canonical stage", () => {
    for (const s of PIPELINE_STAGES) {
      expect(matchesStage(lead(s.key), s.key)).toBe(true);
      for (const other of PIPELINE_STAGES) {
        if (other.key !== s.key) {
          expect(matchesStage(lead(other.key), s.key)).toBe(false);
        }
      }
    }
  });

  it("covers all five canonical stages", () => {
    expect(PIPELINE_STAGES.map((s) => s.key)).toEqual([
      "enquiry",
      "proposal",
      "offer",
      "booking",
      "close",
    ]);
  });

  it("QueueBoard and LeadTable both apply the stage filter and pass stage props", () => {
    for (const file of [
      "src/components/crm/QueueBoard.tsx",
      "src/components/crm/LeadTable.tsx",
    ]) {
      const src = readFileSync(file, "utf8");
      expect(src).toContain("matchesStage(lead, stage)");
      expect(src).toContain("onStageChange");
      expect(src).toContain("stage={stage}");
    }
  });
});
