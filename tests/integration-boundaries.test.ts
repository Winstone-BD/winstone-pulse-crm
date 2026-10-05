import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ecosystem integration boundaries", () => {
  it("keeps the public MCP limited to verified public property facts", () => {
    const index = readFileSync("src/lib/mcp/index.ts", "utf8");
    expect(index).toContain("tools: [listPublicPropertyFacts]");
    expect(index).not.toMatch(/createLead|listLeads|listAgents|getCallIntel|leadHistory|floorSummary/);
    expect(readdirSync("src/lib/mcp/tools")).toEqual(["list-public-property-facts.ts"]);
  });

  it("keeps public mutation and webhook routes behind flood brakes", () => {
    for (const file of [
      "src/routes/api/public/ingest/lead.ts",
      "src/routes/api/public/agent/login.ts",
      "src/routes/api/public/os/events.ts",
      "src/routes/api/public/paddle/webhook.ts",
      "src/routes/api/public/whatsapp/webhook.ts",
    ]) {
      expect(readFileSync(file, "utf8"), file).toContain("createRateLimiter");
    }
  });

  it("queues booking events without inventing an OS endpoint or secret", () => {
    const source = readFileSync("src/lib/os-bridge-outbound.server.ts", "utf8");
    expect(source).toContain('from("sync_events")');
    expect(source).toContain('status: "queued"');
    expect(source).not.toMatch(/process\.env|fetch\(|CRM_BRIDGE_SECRET/);
  });

  it("rejects provider event-id reuse with a changed payload", () => {
    const source = readFileSync("src/lib/webhook-log.server.ts", "utf8");
    expect(source).toContain("payload_sha256");
    expect(source).toContain("event_id_payload_conflict");
  });
});