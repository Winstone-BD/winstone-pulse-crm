import { describe, expect, it, beforeAll } from "vitest";
import { mintUnlockEmailToken, verifyUnlockEmailToken, EMAIL_LINK_MS } from "@/lib/unlock-email.server";
beforeAll(() => { process.env["ADMIN_TOKEN_SECRET"] = "test-secret-123"; });
describe("unlock email token", () => {
  it("verifies, expires and rejects tampering", () => {
    const now = 1_000_000;
    const t = mintUnlockEmailToken("req-1", now);
    expect(verifyUnlockEmailToken(t, now + 1)?.requestId).toBe("req-1");
    expect(verifyUnlockEmailToken(t, now + EMAIL_LINK_MS + 1)).toBeNull();
    expect(verifyUnlockEmailToken(t.replace("req-1", "req-2"), now)).toBeNull();
  });
});
