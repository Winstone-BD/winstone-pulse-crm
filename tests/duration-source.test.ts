import { describe, expect, it } from "vitest";
import { pickPhoneMeasuredCall, resolveDurationSource, durationSourceLabel } from "@/lib/call-duration";

describe("call duration source", () => {
  it("phone-measured time is labelled as Android sync", () => {
    expect(resolveDurationSource({ phoneSeconds: 95, storedSeconds: 120 })).toBe("phone_sync");
  });
  it("falls back to the web timer, then to typed time", () => {
    expect(resolveDurationSource({ phoneSeconds: null, storedSeconds: 120 })).toBe("web_timer");
    expect(resolveDurationSource({ phoneSeconds: null, storedSeconds: 0 })).toBe("entered");
  });
  it("WhatsApp calls are never phone-measured", () => {
    expect(resolveDurationSource({ channel: "whatsapp", phoneSeconds: 95 })).toBe("whatsapp_entered");
  });
  it("returns the sync time of the matched phone row", () => {
    const m = pickPhoneMeasuredCall("2026-10-18T10:00:00Z", [
      { started_at: "2026-10-18T09:50:00Z", created_at: "2026-10-18T09:58:00Z", duration_seconds: 80, call_source: "android" },
    ]);
    expect(m).toEqual({ seconds: 80, syncedAt: "2026-10-18T09:58:00Z" });
  });
  it("old reports without a source say unknown", () => {
    expect(durationSourceLabel(null)).toBe("উৎস জানা নেই");
  });
});
