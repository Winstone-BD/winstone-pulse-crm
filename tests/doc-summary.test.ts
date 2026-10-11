import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { stripFence } from "@/lib/doc-summary.functions";
import { KB_SUMMARY_PROMPT } from "@/lib/kb-summary.functions";

describe("stripFence", () => {
  it("removes a markdown fence around JSON", () => {
    expect(stripFence("```json\n{\"a\":1}\n```")).toBe('{"a":1}');
  });

  it("leaves plain JSON untouched", () => {
    expect(stripFence('{"a":1}')).toBe('{"a":1}');
  });
});

describe("summarizeDocument access", () => {
  it("allows any approved staff account, not only HQ/IT dispatch", () => {
    const source = readFileSync("src/lib/doc-summary.functions.ts", "utf8");
    expect(source).not.toContain("requireDispatch(caller)");
    expect(source).toContain('caller.scope === "none"');
  });

  it("audits every summary with the actor", () => {
    const source = readFileSync("src/lib/doc-summary.functions.ts", "utf8");
    expect(source).toContain('"document_summarized"');
  });
});

describe("kbArticleSummary", () => {
  it("requires support-lead write scope, matching the KB editor", () => {
    const source = readFileSync("src/lib/kb-summary.functions.ts", "utf8");
    expect(source).toContain("requireSupportLead");
    expect(source).toContain("requireWrite");
  });

  it("never invents content and caps the summary at two sentences", () => {
    expect(KB_SUMMARY_PROMPT).toContain("কল্পনা করবে না");
    expect(KB_SUMMARY_PROMPT).toContain("সর্বোচ্চ ২ বাক্য");
  });
});

describe("summarizeDriveDoc", () => {
  it("stays HQ/IT-only so agents keep no direct Drive access", () => {
    const source = readFileSync("src/lib/drive-knowledge.functions.ts", "utf8");
    expect(source).toContain("summarizeDriveDoc");
    expect(source).toContain("requireAuthority(caller)");
  });
});
