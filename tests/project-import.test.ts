import { describe, expect, it } from "vitest";
import { mapHeader, parseCsv, parsePrice, sheetToRows } from "@/lib/project-import";

describe("project catalog import", () => {
  it("parses quoted CSV with BOM, commas and CRLF", () => {
    expect(parseCsv('\uFEFFname,notes\r\n"Winstone, Heights","say ""hi"""\r\n\r\n')).toEqual([["name", "notes"], ["Winstone, Heights", 'say "hi"']]);
  });
  it("maps English and Bengali headers, reports unknown ones", () => {
    expect(mapHeader("Project Name")).toBe("name");
    expect(mapHeader("প্রতি বর্গফুট")).toBe("price_per_sqft");
    const r = sheetToRows([["নাম", "লোকেশন", "foo"], ["A", "Dhaka", "x"], ["", "", ""]]);
    expect(r.rows).toEqual([{ name: "A", location: "Dhaka" }]);
    expect(r.unknownHeaders).toEqual(["foo"]);
    expect(r.missingName).toBe(false);
    expect(sheetToRows([["location"], ["x"]]).missingName).toBe(true);
  });
  it("parses prices without guessing", () => {
    expect(parsePrice("৳1,25,000")).toBe(125000);
    expect(parsePrice("১২৫০০")).toBe(12500);
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("call for price")).toBe("invalid");
  });
});
