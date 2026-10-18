import { expect, it } from "vitest";
import { leadFileFormat } from "../src/lib/lead-file-format";
it("detects contents independently of title or MIME", () => {
  expect(leadFileFormat(new TextEncoder().encode("%PDF-1.7"), "application/octet-stream")).toBe("pdf");
  expect(leadFileFormat(new Uint8Array([80, 75, 3, 4]), "application/octet-stream")).toBe("office");
  expect(leadFileFormat(new TextEncoder().encode("name,phone\nBuyer,01712345678"), "application/octet-stream")).toBe("text");
});
it("refuses unsupported binary and legacy Office", () => {
  expect(() => leadFileFormat(new Uint8Array([0, 1, 2]), "application/octet-stream")).toThrow("Unsupported binary");
  expect(() => leadFileFormat(new Uint8Array([208, 207, 17]), "application/msword")).toThrow("Legacy DOC/XLS");
});