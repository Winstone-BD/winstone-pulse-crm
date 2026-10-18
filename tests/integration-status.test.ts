import { it, expect, vi, afterEach } from "vitest";
import {
  integrationFailure,
  recordingRetryEligibility,
  canonicalDriveMatch,
} from "../src/lib/integration-status";
it("403 binding cannot retry or claim success", () =>
  expect(integrationFailure(403, '{"type":"lovable_api_key_not_registered"}')).toMatchObject({
    code: "project_binding",
    status: 403,
    retryable: false,
  }));
it("permission 403 is not a missing file", () =>
  expect(integrationFailure(403, "forbidden")).toMatchObject({
    code: "permission",
    retryable: false,
  }));
it("missing audio requires device resync", () =>
  expect(recordingRetryEligibility(null, "not_available").allowed).toBe(false));
it("available stored path is retryable", () =>
  expect(recordingRetryEligibility("audio/a.mp3", "available").allowed).toBe(true));
it("filename alone cannot map a recording", () =>
  expect(canonicalDriveMatch(undefined)).toBeNull());
it("canonical metadata requires both IDs", () => {
  expect(canonicalDriveMatch({ lead_id: "fbed8866-772f-442c-9dd5-8d64ac295e30" })).toBeNull();
  expect(
    canonicalDriveMatch({
      lead_id: "fbed8866-772f-442c-9dd5-8d64ac295e30",
      call_recording_id: "fbed8866-772f-442c-9dd5-8d64ac295e31",
    }),
  ).toMatchObject({ callId: "fbed8866-772f-442c-9dd5-8d64ac295e31" });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("Drive permission failure propagates instead of recreating folders", async () => {
  vi.stubEnv("LOVABLE_API_KEY", "test");
  vi.stubEnv("GOOGLE_DRIVE_API_KEY", "test");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("forbidden", { status: 403 })),
  );
  const { driveFolderExists } = await import("../src/lib/gdrive.server");
  await expect(driveFolderExists("folder")).rejects.toThrow("[403]");
  expect(fetch).toHaveBeenCalledTimes(1);
});
