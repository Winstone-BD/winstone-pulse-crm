import { describe, expect, it } from "vitest";

import { rankDriveDocs, type DriveDoc } from "@/lib/drive-knowledge.server";

const doc = (name: string, content: string): DriveDoc => ({
  fileId: name,
  name,
  folderName: "Documents",
  webViewLink: null,
  content,
  indexedAt: "2026-09-30T00:00:00.000Z",
  modifiedTime: null,
});

describe("rankDriveDocs", () => {
  const docs = [
    doc("Sales Training Guide", "How to open a call, handle price objections."),
    doc("Shift Summary August", "Agent totals for August, calls and site visits."),
  ];

  it("returns the matching document first", () => {
    const [best] = rankDriveDocs(docs, "price objection training");
    expect(best?.name).toBe("Sales Training Guide");
  });

  it("returns nothing when no document matches", () => {
    expect(rankDriveDocs(docs, "helicopter landing pad")).toEqual([]);
  });

  it("returns nothing for a query with no usable words", () => {
    expect(rankDriveDocs(docs, "?? ..")).toEqual([]);
  });

  it("never returns more than the limit", () => {
    expect(rankDriveDocs(docs, "calls price August", 1)).toHaveLength(1);
  });
});
