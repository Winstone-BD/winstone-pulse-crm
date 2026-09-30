import { describe, expect, it } from "vitest";

import { isCrmClosureActive } from "../src/lib/service-interruption";

describe("ended temporary CRM closure", () => {
  it("keeps the CRM open after the maintenance window", () => {
    expect(isCrmClosureActive()).toBe(false);
  });
});