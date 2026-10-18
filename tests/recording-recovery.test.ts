import { describe, expect, it } from "vitest";
import { recordingRecovery, assertRecordingRetry, analysisOutcomeOk } from "../src/lib/recording-recovery";

const row = { storage_path: "audio/call.mp3", audio_url: null, upload_status: "uploaded", analysis_status: "failed", analysis_error: "AI_PROVIDER_FAILED", stt_error_message: null, transcription_text: "আসল কথোপকথন", ai_summary: null };
describe("recording recovery", () => {
  it("requires real audio upload before either retry", () => {
    const missing = { ...row, storage_path: null };
    expect(recordingRecovery(missing).nextAction).toBe("recover_upload");
    expect(() => assertRecordingRetry(missing, "drive")).toThrow();
    expect(() => assertRecordingRetry(missing, "analysis")).toThrow();
  });
  it("does not confuse analysis failure with an upload failure", () => {
    expect(recordingRecovery(row).missingUpload).toBe(false);
    expect(recordingRecovery(row).blockedStage).toBe("analysis");
    expect(recordingRecovery(row).reason).toBe("AI_PROVIDER_FAILED");
  });
  it("offers Drive retry for an absent backup only with stored audio", () => {
    expect(recordingRecovery(row, null).driveRetry).toBe(true);
    expect(recordingRecovery(row, "verified").driveRetry).toBe(false);
  });
  it("blocks duplicate processing and unavailable-audio analysis", () => {
    expect(() => assertRecordingRetry({ ...row, analysis_status: "processing" }, "analysis")).toThrow();
    expect(() => assertRecordingRetry({ ...row, analysis_status: "not_available" }, "analysis")).toThrow();
  });
  it("never labels failed or unavailable analysis as successful", () => {
    expect(analysisOutcomeOk("failed")).toBe(false);
    expect(analysisOutcomeOk("not_available")).toBe(false);
    expect(analysisOutcomeOk("completed")).toBe(true);
  });
});