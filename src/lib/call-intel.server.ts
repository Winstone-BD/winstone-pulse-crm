import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAiUsage } from "@/lib/ai-usage.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

function apiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return key;
}

export const AUDIO_BUCKET = "call-audio";

/**
 * Bangla-first transcription. Sarvam AI runs the speech-to-text when its key is
 * configured; otherwise the built-in transcription model is used so calls never
 * stall waiting on an external account.
 */
export async function transcribeCall(bytes: Uint8Array, filename: string) {
  const ext = filename.split(".").pop() ?? "mp3";
  const { transcribeWithAdapter } = await import("@/lib/stt-provider.server");
  return transcribeWithAdapter(bytes, filename, mimeFor(ext));
}

/** Transcript-only helper kept for existing callers. */
export async function transcribeAudio(bytes: Uint8Array, filename: string): Promise<string> {
  const result = await transcribeCall(bytes, filename);
  if (result.status === "failed") throw new Error(result.errorMessage ?? "Transcription failed");
  return result.transcript;
}

export const AI_LEAD_CATEGORIES = [
  "hot_lead",
  "follow_up",
  "interested",
  "not_interested",
  "callback",
  "no_answer",
  "wrong_number",
  "closed_converted",
] as const;

export type CallAnalysis = {
  summary_bullets: string[];
  sentiment: "positive" | "neutral" | "negative" | "critical";
  objections: string[];
  deal_stage: string;
  intent: string;
  lead_category: (typeof AI_LEAD_CATEGORIES)[number];
  next_action: string;
  suggested_temperature: "hot" | "warm" | "cold";
  suggested_grade: "A" | "B" | "C" | "D";
  timestamped_transcript: string;
};

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary_bullets",
    "sentiment",
    "objections",
    "deal_stage",
    "intent",
    "lead_category",
    "next_action",
    "suggested_temperature",
    "suggested_grade",
    "timestamped_transcript",
  ],
  properties: {
    intent: {
      type: "string",
      description: "Customer's intent in one short Bangla sentence.",
    },
    lead_category: { type: "string", enum: [...AI_LEAD_CATEGORIES] },
    next_action: {
      type: "string",
      description: "Recommended next step for the agent, one short Bangla sentence.",
    },
    summary_bullets: {
      type: "array",
      items: { type: "string" },
      description: "Exactly three short bullets summarising the call.",
    },
    sentiment: { type: "string", enum: ["positive", "neutral", "negative", "critical"] },
    suggested_temperature: {
      type: "string",
      enum: ["hot", "warm", "cold"],
      description: "Suggested lead temperature based on buying intent in this call.",
    },
    suggested_grade: {
      type: "string",
      enum: ["A", "B", "C", "D"],
      description: "Suggested lead grade: A best fit / highest value, D weakest.",
    },
    objections: { type: "array", items: { type: "string" } },
    deal_stage: { type: "string" },
    timestamped_transcript: {
      type: "string",
      description:
        "The transcript rewritten as lines of the form [MM:SS] Agent: text or [MM:SS] Customer: text",
    },
  },
} as const;

/** Runs the sales-call analysis on a raw transcript using Lovable AI. */
export async function analyzeTranscript(
  transcript: string,
  durationSeconds: number,
): Promise<CallAnalysis> {
  const res = await fetch(`${GATEWAY}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey(),
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      reasoning: { effort: "low", summary: "auto" },
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text: "You analyse tele-sales phone calls for a Bangladeshi B2B sales team. Calls are in Bangla. Write summary_bullets, objections, deal_stage, intent and next_action in Bangla, and keep the transcript in its original Bangla wording. lead_category must be the single best-fitting category id for the call outcome. Be concise and factual, never invent facts that are not in the transcript.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Analyse this sales call (about ${durationSeconds} seconds long). Split the raw transcript into speaker lines with plausible [MM:SS] timestamps spread evenly across the call duration, labelling each line as Agent or Customer.\n\nRaw transcript:\n${transcript}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "call_analysis",
          strict: true,
          schema: ANALYSIS_SCHEMA,
        },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Call analysis failed (${res.status}): ${await res.text().catch(() => "")}`);
  }

  const raw = await readSseText(res);
  const parsed = JSON.parse(raw) as CallAnalysis;
  return parsed;
}

async function readSseText(res: Response): Promise<string> {
  const body = res.body;
  if (!body) throw new Error("Empty analysis response");

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          response?: { output_text?: string };
        };
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          text += event.delta;
        } else if (event.type === "response.completed" && event.response?.output_text) {
          if (!text) text = event.response.output_text;
        }
      } catch {
        // ignore keep-alive / partial frames
      }
    }
  }

  if (!text) throw new Error("Analysis returned no content");
  return text;
}

/** Transcribes + analyses a stored recording and writes the intelligence back to the row. */
export async function processRecording(recordingId: string): Promise<"done" | "empty"> {
  const { data: recording, error } = await supabaseAdmin
    .from("call_recordings")
    .select("*")
    .eq("id", recordingId)
    .single();
  if (error || !recording) throw new Error(error?.message ?? "Recording not found");
  if (!recording.audio_url) throw new Error("Recording has no audio file");

  const { data: file, error: downloadError } = await supabaseAdmin.storage
    .from(AUDIO_BUCKET)
    .download(recording.audio_url);
  if (downloadError || !file) throw new Error(downloadError?.message ?? "Audio download failed");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const filename = recording.audio_url.split("/").pop() ?? "recording.mp3";

  try {
    const stt = await transcribeCall(bytes, filename);
    const provider = {
      stt_provider: stt.provider,
      stt_model: stt.model,
      stt_language: stt.language,
      stt_fallback_used: stt.fallbackUsed,
      stt_error_code: stt.errorCode,
      stt_error_message: stt.errorMessage,
      stt_request_id: stt.requestId,
      stt_duration_ms: stt.durationMs,
    };

    if (stt.status === "failed" || !stt.transcript) {
      await supabaseAdmin
        .from("call_recordings")
        .update({
          ...provider,
          stt_status: "failed",
          sync_status: stt.status === "failed" ? "failed" : recording.sync_status,
        })
        .eq("id", recordingId);
      if (stt.status === "failed") throw new Error(stt.errorMessage ?? "Transcription failed");
      return "empty";
    }

    const transcript = stt.transcript;
    await logAiUsage({
      category: "transcription",
      model: stt.model ?? stt.provider,
      actorProfileId: recording.agent_id,
      detail: recordingId,
    });
    const analysis = await analyzeTranscript(transcript, recording.duration_seconds);
    await logAiUsage({
      category: "analysis",
      model: "openai/gpt-6-astra",
      actorProfileId: recording.agent_id,
      detail: recordingId,
    });

    await supabaseAdmin
      .from("call_recordings")
      .update({
        ...provider,
        stt_status: "completed",
        transcribed_at: new Date().toISOString(),

        transcription_text: analysis.timestamped_transcript || transcript,
        ai_summary: analysis.summary_bullets.map((b) => `• ${b}`).join("\n"),
        sentiment: analysis.sentiment,
        customer_objections: analysis.objections,
        deal_stage: analysis.deal_stage,
        ai_intent: analysis.intent,
        ai_lead_category: analysis.lead_category,
        ai_next_action: analysis.next_action,
        ai_temperature: analysis.suggested_temperature,
        ai_grade: analysis.suggested_grade,
        sync_status: recording.is_two_sided ? "verified" : "uploaded",
      })
      .eq("id", recordingId);
    return "done";
  } catch (err) {
    await supabaseAdmin
      .from("call_recordings")
      .update({ stt_status: "failed", sync_status: "failed" })

      .eq("id", recordingId);
    throw err;
  }
}

/** Stores an uploaded call, bumps the lead, and returns the new recording id. */
const MAX_RECORDING_BYTES = 24 * 1024 * 1024;
const AUDIO_EXTENSIONS = new Set(["m4a", "mp4", "3gp", "aac", "mp3", "wav", "ogg", "opus", "amr", "webm"]);

/** Rejects oversized uploads and anything whose bytes are not a known audio container. */
export function assertAudioUpload(base64: string, ext: string): Uint8Array {
  const extension = ext.toLowerCase().replace(/^\./, "");
  if (!AUDIO_EXTENSIONS.has(extension)) throw new Error("Unsupported audio file type");
  if (base64.length > Math.ceil((MAX_RECORDING_BYTES * 4) / 3) + 8) {
    throw new Error("Recording is larger than 24 MB");
  }
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  if (bytes.byteLength > MAX_RECORDING_BYTES) throw new Error("Recording is larger than 24 MB");
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  const isAudio =
    ascii(4, 8) === "ftyp" || // m4a / mp4 / 3gp
    ascii(0, 3) === "ID3" ||
    (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) || // mp3 / aac frame sync
    (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") ||
    ascii(0, 4) === "OggS" ||
    ascii(0, 5) === "#!AMR" ||
    (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3); // webm
  if (!isAudio) throw new Error("The uploaded file is not a recognised audio recording");
  return bytes;
}

export async function ingestRecording(input: {
  leadId: string;
  agentId: string | null;
  audioBase64: string;
  fileExtension: string;
  durationSeconds: number;
  direction: "outgoing" | "incoming_callback";
  isTwoSided: boolean;
  clientUploadId?: string | null;
  recorderSource?: string | null;
  deviceId?: string | null;
  callSource?: string | null;
  callStartedAt?: string | null;
}): Promise<string> {
  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", input.leadId)
    .single();
  if (leadError || !lead) throw new Error(leadError?.message ?? "Lead not found");

  const bytes = assertAudioUpload(input.audioBase64, input.fileExtension);
  const agentId = input.agentId ?? lead.assigned_to;
  const fileName = `${Date.now()}.${input.fileExtension.toLowerCase().replace(/^\./, "")}`;
  // agent/lead/file keeps every object inside an ownership-shaped prefix.
  const path = `uploads/${agentId ?? "unassigned"}/${input.leadId}/${fileName}`;
  const checksum = await sha256Hex(bytes);

  const { error: uploadError } = await supabaseAdmin.storage
    .from(AUDIO_BUCKET)
    .upload(path, bytes, { contentType: mimeFor(input.fileExtension) });
  if (uploadError) throw new Error(uploadError.message);

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("call_recordings")
    .insert({
      lead_id: input.leadId,
      agent_id: agentId,
      phone_number: lead.phone_number,
      call_direction: input.direction,
      duration_seconds: input.durationSeconds,
      audio_url: path,
      is_two_sided: input.isTwoSided,
      sync_status: "uploaded",
      client_upload_id: input.clientUploadId ?? null,
      recorder_source: input.recorderSource ?? null,
      device_id: input.deviceId ?? null,
      analysis_status: "pending",
      call_source: input.callSource ?? "android_sim",
      call_status: "completed",
      external_call_id: input.clientUploadId ?? null,
      started_at: input.callStartedAt ?? null,
      finished_at: new Date().toISOString(),
      recording_status: "available",
      upload_status: "uploaded",
      storage_bucket: AUDIO_BUCKET,
      storage_path: path,
      file_name: fileName,
      mime_type: mimeFor(input.fileExtension),
      file_size_bytes: bytes.byteLength,
      checksum,
    })
    .select("id")
    .single();
  if (insertError || !inserted) throw new Error(insertError?.message ?? "Could not save recording");

  await supabaseAdmin
    .from("leads")
    .update({
      call_attempts: lead.call_attempts + 1,
      last_call_at: new Date().toISOString(),
      status: lead.status === "pending" ? "contacted" : lead.status,
      is_verified: lead.is_verified || input.isTwoSided,
    })
    .eq("id", input.leadId);

  // Retry-safe job rows: upload done, transcription + AI queued.
  const { queueCallJobs } = await import("@/lib/call-jobs.server");
  await queueCallJobs(inserted.id, true);

  return inserted.id;
}

/** Stable checksum so a re-uploaded file is recognisable as the same audio. */
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function mimeFor(ext: string): string {
  switch (ext.toLowerCase()) {
    case "wav":
      return "audio/wav";
    case "m4a":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    default:
      return "audio/mpeg";
  }
}
