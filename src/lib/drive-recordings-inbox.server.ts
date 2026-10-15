// Server-only: Drive "Call Recordings Inbox" folder → CRM.
// Each new audio file is matched to its lead by the phone number in its file
// name, then to the nearest call of that lead (±20 min of the file time).
// Files that cannot be matched wait in a review queue for HQ to link.
// Files are never moved or deleted in Drive; nothing is invented.
import { driveFetch } from "@/lib/gdrive.server";

const CONFIG_ID = "recordings_inbox_drive";
const FOLDER_NAME = "WINSTONE PULSE — Call Recordings Inbox";
const AUDIO_EXT = /\.(mp3|m4a|amr|wav|aac|ogg|opus|3gp|mp4)$/i;
const WINDOW_MS = 20 * 60_000;

async function db() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/** Pure: pull a Bangladesh mobile number out of a file name, as 01XXXXXXXXX. */
export function phoneFromFileName(name: string): string | null {
  const digits = name.replace(/[\s\-_.()]/g, "");
  const m = digits.match(/(?:\+?88)?(01[3-9]\d{8})(?!\d)/);
  return m ? m[1] : null;
}

export async function getInboxFolder(): Promise<{ id: string; url: string } | null> {
  const { data } = await (await db()).from("app_config").select("data").eq("id", CONFIG_ID).maybeSingle();
  const id = (data?.data as { folderId?: string } | null)?.folderId;
  return id ? { id, url: `https://drive.google.com/drive/folders/${id}` } : null;
}

export async function ensureInboxFolder() {
  const existing = await getInboxFolder();
  if (existing) return existing;
  const created = await driveFetch<{ id: string }>("/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!created?.id) throw new Error("Google Drive did not return a folder");
  const { error } = await (await db()).from("app_config").upsert({ id: CONFIG_ID, data: { folderId: created.id }, updated_at: new Date().toISOString() } as never);
  if (error) throw new Error(error.message);
  return { id: created.id, url: `https://drive.google.com/drive/folders/${created.id}` };
}

type DriveFile = { id: string; name: string; mimeType?: string; webViewLink?: string; createdTime?: string };

export async function syncRecordingsInbox() {
  const folder = await getInboxFolder();
  if (!folder) throw new Error("Recordings folder not created yet");
  const d = await db();
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const q = encodeURIComponent(`'${folder.id}' in parents and trashed=false`);
    const r = await driveFetch<{ files?: DriveFile[]; nextPageToken?: string }>(
      `/files?q=${q}&pageSize=200&fields=nextPageToken,files(id,name,mimeType,webViewLink,createdTime)${pageToken ? `&pageToken=${pageToken}` : ""}`,
    );
    files.push(...(r?.files ?? []));
    pageToken = r?.nextPageToken;
  } while (pageToken && files.length < 2000);

  const audio = files.filter((f) => f.mimeType?.startsWith("audio/") || AUDIO_EXT.test(f.name));
  if (!audio.length) return { scanned: 0, matched: 0, unmatched: 0 };
  const { data: seen } = await d.from("drive_recording_imports").select("drive_file_id").in("drive_file_id", audio.map((f) => f.id));
  const known = new Set((seen ?? []).map((s) => s.drive_file_id));
  let matched = 0, unmatched = 0;
  for (const f of audio) {
    if (known.has(f.id)) continue;
    const phone = phoneFromFileName(f.name);
    let leadId: string | null = null, callId: string | null = null, agentId: string | null = null, method: string | null = null;
    if (phone) {
      const { data: st } = await d.rpc("lead_phone_status", { _raw: phone });
      leadId = (Array.isArray(st) ? st[0]?.existing_lead_id : null) ?? null;
      if (leadId) method = "phone";
    }
    if (leadId && f.createdTime) {
      const t = Date.parse(f.createdTime);
      const { data: calls } = await d.from("call_recordings").select("id, agent_id, started_at, created_at").eq("lead_id", leadId)
        .gte("created_at", new Date(t - 6 * 3_600_000).toISOString()).lte("created_at", new Date(t + 3_600_000).toISOString()).limit(50);
      let best: { id: string; agent_id: string | null; diff: number } | null = null;
      for (const c of calls ?? []) {
        const diff = Math.abs(Date.parse((c.started_at ?? c.created_at) as string) - t);
        if (diff <= WINDOW_MS && (!best || diff < best.diff)) best = { id: c.id, agent_id: c.agent_id, diff };
      }
      if (best) { callId = best.id; agentId = best.agent_id; method = "phone+call_time"; }
    }
    if (!agentId && leadId) {
      const { data: l } = await d.from("leads").select("assigned_to").eq("id", leadId).maybeSingle();
      agentId = l?.assigned_to ?? null;
    }
    const { error } = await d.from("drive_recording_imports").insert({
      drive_file_id: f.id, file_name: f.name, mime_type: f.mimeType ?? null, drive_link: f.webViewLink ?? null,
      file_created_at: f.createdTime ?? null, lead_id: leadId, call_recording_id: callId, agent_id: agentId,
      match_method: method, status: leadId ? "matched" : "unmatched",
    });
    if (error) { if (error.code === "23505") continue; throw new Error(error.message); }
    if (leadId) {
      matched++;
      await d.from("lead_events").insert({ lead_id: leadId, agent_id: agentId, recording_id: callId, kind: "drive_recording_linked", detail: f.name.slice(0, 200) });
    } else unmatched++;
  }
  return { scanned: audio.length, matched, unmatched };
}

export async function listInbox() {
  const d = await db();
  const { data, error } = await d.from("drive_recording_imports").select("id, file_name, drive_link, file_created_at, lead_id, call_recording_id, match_method, status, created_at")
    .order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  const ids = [...new Set((data ?? []).map((r) => r.lead_id).filter(Boolean))] as string[];
  const names = new Map(((ids.length ? (await d.from("leads").select("id, name").in("id", ids)).data : []) ?? []).map((l) => [l.id, l.name]));
  return (data ?? []).map((r) => ({ ...r, lead_name: r.lead_id ? names.get(r.lead_id) ?? null : null }));
}

/** HQ links an unmatched file to a lead found by phone number. */
export async function linkInboxFile(importId: string, phone: string, by: string) {
  const d = await db();
  const { data: st } = await d.rpc("lead_phone_status", { _raw: phone });
  const leadId = (Array.isArray(st) ? st[0]?.existing_lead_id : null) ?? null;
  if (!leadId) throw new Error("No lead with that phone number");
  const { data: row, error } = await d.from("drive_recording_imports").update({ lead_id: leadId, status: "linked", match_method: "hq_manual", linked_by: by, updated_at: new Date().toISOString() })
    .eq("id", importId).eq("status", "unmatched").select("file_name").maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("This file was already handled");
  await d.from("lead_events").insert({ lead_id: leadId, kind: "drive_recording_linked", detail: `HQ linked: ${row.file_name.slice(0, 180)}` });
  return { leadId };
}

export async function leadDriveRecordings(leadId: string) {
  const { data } = await (await db()).from("drive_recording_imports").select("id, file_name, drive_link, file_created_at, match_method")
    .eq("lead_id", leadId).order("file_created_at", { ascending: false }).limit(50);
  return data ?? [];
}
