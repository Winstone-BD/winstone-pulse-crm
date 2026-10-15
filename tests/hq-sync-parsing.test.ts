import { describe, expect, it } from "vitest";

import { phoneFromFileName } from "@/lib/drive-recordings-inbox.server";
import { parseSheetEdits } from "@/lib/sheet-pull.server";

const id = "11111111-2222-3333-4444-555555555555";
const row = (o: Record<number, string>) => Array.from({ length: 14 }, (_, i) => o[i] ?? "");

describe("phoneFromFileName", () => {
  it("finds BD mobile numbers", () => {
    expect(phoneFromFileName("8801712345678_call.m4a")).toBe("01712345678");
    expect(phoneFromFileName("Call 017-1234-5678.mp3")).toBe("01712345678");
    expect(phoneFromFileName("recording.mp3")).toBeNull();
  });
});

describe("parseSheetEdits", () => {
  it("reads only allowed HQ columns", () => {
    const edits = parseSheetEdits([
      row({}),
      row({ 0: "A", 4: "Offer", 11: "Call Friday", 12: "$1,200.50", 13: id }),
      row({ 0: "B", 4: "made-up", 12: "abc", 13: id }),
      row({ 0: "New buyer", 1: "01812345678" }),
    ]);
    expect(edits).toEqual([
      { kind: "stage", leadId: id, value: "offer" },
      { kind: "note", leadId: id, value: "Call Friday" },
      { kind: "payment", leadId: id, value: 1200.5 },
      { kind: "new_lead", name: "New buyer", phone: "01812345678" },
    ]);
  });
});
