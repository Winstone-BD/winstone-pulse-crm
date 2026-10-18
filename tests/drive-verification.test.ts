import { afterEach, describe, expect, it, vi } from "vitest";
import { driveFileMeta } from "../src/lib/gdrive.server";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
function response(status: number, body: object) {
  vi.stubEnv("LOVABLE_API_KEY", "test-placeholder");
  vi.stubEnv("GOOGLE_DRIVE_API_KEY", "test-placeholder");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}
describe("real Drive verification", () => {
  it("keeps connection failures unverified, not missing", async () => {
    response(403, { error: "permission denied" });
    await expect(driveFileMeta("test-file")).rejects.toThrow("[403]");
  });
  it("reports a missing file only when Drive returns 404", async () => {
    response(404, { error: "not found" });
    expect(await driveFileMeta("test-file")).toBeNull();
  });
  it("returns actual file metadata, including trash state", async () => {
    response(200, { id: "test-file", name: "call.mp3", size: "42", trashed: false });
    expect(await driveFileMeta("test-file")).toMatchObject({ id: "test-file", size: 42, trashed: false });
  });
});