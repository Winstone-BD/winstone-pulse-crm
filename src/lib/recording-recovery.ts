/** Browser-safe recovery rules shared by diagnostics and operational retries. */
export type RecoveryRecording = {
  storage_path: string | null;
  audio_url: string | null;
  upload_status: string;
  analysis_status: string;
  analysis_error: string | null;
  stt_error_message: string | null;
  transcription_text: string | null;
  ai_summary: string | null;
};

export function recordingRecovery(row: RecoveryRecording, driveStatus?: string | null) {
  const hasAudio = Boolean(row.storage_path || row.audio_url);
  const terminal = row.analysis_status === "not_available";
  const active = row.analysis_status === "processing";
  const missingUpload = !hasAudio;
  const driveRetry = Boolean(row.storage_path) && !["done", "verified"].includes(driveStatus ?? "");
  const analysisRetry = hasAudio && !terminal && !active && row.analysis_status !== "completed";
  const blockedStage = missingUpload ? "upload" : !row.transcription_text ? "transcription" : !row.ai_summary ? "analysis" : driveRetry ? "drive" : null;
  return {
    hasAudio, missingUpload, driveRetry, analysisRetry, blockedStage,
    reason: missingUpload ? "AUDIO_MISSING" : row.analysis_error ?? row.stt_error_message ?? null,
    nextAction: missingUpload ? "recover_upload" : terminal ? "review_audio" : active ? "wait_processing" : analysisRetry ? "analysis" : driveRetry ? "drive" : "review_report",
  };
}

export function assertRecordingRetry(row: RecoveryRecording, step: "drive" | "analysis") {
  const recovery = recordingRecovery(row);
  if (!recovery.hasAudio || (step === "drive" && !row.storage_path)) {
    throw new Error("আগে ফোন থেকে আসল অডিও উদ্ধার করে একই কলের রেকর্ডিং আপলোড করুন; রিট্রাই দিয়ে অনুপস্থিত অডিও তৈরি হয় না।");
  }
  if (step === "analysis" && row.analysis_status === "processing") {
    throw new Error("বিশ্লেষণ চলছে; একই রেকর্ডিংয়ে আরেকটি বিশ্লেষণ শুরু করা হয়নি।");
  }
  if (step === "analysis" && row.analysis_status === "not_available") {
    throw new Error("এই অডিওর বিশ্লেষণ বন্ধ হয়েছে; ত্রুটি ও অডিও যাচাই করুন, একই ফাইলে অন্ধ রিট্রাই নয়।");
  }
}

export function analysisOutcomeOk(outcome: string) {
  return outcome === "completed";
}