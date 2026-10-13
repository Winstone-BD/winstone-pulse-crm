import { describe, expect, it } from "vitest";
import { checkStagingUrl, isolationFromMetadata } from "@/lib/staging-check";

describe("staging checklist helpers", () => {
  it("accepts a public https staging address", () => expect(checkStagingUrl("https://my-staging.lovable.app/x").ok).toBe(true));
  it("rejects live, preview, http and local addresses", () => {
    for (const u of ["https://crm.winstonebd.com", "https://winstone-pulse-crm.lovable.app", "https://id-preview--990267f3-4198-4d83-ae21-7d9c802617f4.lovable.app", "http://a.lovable.app", "https://localhost", "https://10.0.0.1", "nope"])
      expect(checkStagingUrl(u).ok).toBe(false);
  });
  it("classifies sign-in metadata", () => {
    expect(isolationFromMetadata({ authorization_servers: ["https://abcdefghijklmnopqrst.supabase.co/auth/v1"] })).toBe("separate");
    expect(isolationFromMetadata({ authorization_servers: ["https://siepfegeubbqwhodyxcg.supabase.co/auth/v1"] })).toBe("live");
    expect(isolationFromMetadata({ authorization_servers: ["https://proxy.example.com/auth"] })).toBe("unknown");
    expect(isolationFromMetadata({})).toBe("unknown");
  });
});
