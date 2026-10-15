import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  createRecordingsFolder, decideSheetProposal, getRecordingsInbox, linkRecordingFile, listSheetProposals, syncRecordingsFolder,
} from "@/lib/hq-sync.functions";
import { getAdminToken } from "@/lib/local-session";

const btn = "rounded-md px-2.5 py-1 text-xs font-semibold disabled:opacity-50";
const err = (e: unknown) => toast.error(e instanceof Error ? e.message : "Something went wrong");

function describe(p: { kind: string; proposed: unknown; current_value: string | null }) {
  const v = p.proposed as { value?: string | number; name?: string; phone?: string };
  if (p.kind === "stage") return `Stage: ${p.current_value ?? "?"} → ${v.value}`;
  if (p.kind === "note") return `HQ note: “${v.value}”`;
  if (p.kind === "payment") return `Payment USD ${v.value} (becomes a pending booking)`;
  return `New lead: ${v.name} · ${v.phone} (lands unassigned)`;
}

/** HQ edits found in the Daily report Google Sheet — applied only when HQ approves. */
export function SheetProposals() {
  const qc = useQueryClient();
  const list = useServerFn(listSheetProposals);
  const decide = useServerFn(decideSheetProposal);
  const q = useQuery({ queryKey: ["sheet-proposals"], queryFn: () => list({ data: { token: getAdminToken() } }) });
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (id: string, approve: boolean) => {
    setBusy(id);
    try {
      const r = await decide({ data: { token: getAdminToken(), id, approve } });
      toast[r.status === "applied" ? "success" : "info"](r.note ?? (r.status === "applied" ? "Saved to the CRM" : "Rejected"));
      await qc.invalidateQueries({ queryKey: ["sheet-proposals"] });
    } catch (e) { err(e); } finally { setBusy(null); }
  };
  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-4">
      <h2 className="text-base font-semibold">Changes from the Google Sheet</h2>
      <p className="text-xs text-muted-foreground">HQ can edit Stage, “HQ note”, “HQ payment (USD)” or add a row with Lead + Phone. Edits are read at every sync (and at 6:30 PM Dhaka) and only reach the CRM after you approve them here.</p>
      {q.isError ? <p className="mt-2 text-sm text-destructive">{(q.error as Error).message}</p> : null}
      {q.data?.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No sheet changes waiting.</p> : null}
      <ul className="mt-3 space-y-2">
        {q.data?.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2 text-sm">
            <span><b>{p.lead_name ?? "New lead"}</b> · {describe(p)} <span className="text-xs text-muted-foreground">(tab {p.sheet_date})</span></span>
            <span className="flex gap-2">
              <button className={`${btn} bg-primary text-primary-foreground`} disabled={busy === p.id} onClick={() => { if (window.confirm(`Apply to the CRM?\n${describe(p)}`)) void act(p.id, true); }}>Approve</button>
              <button className={`${btn} border border-border`} disabled={busy === p.id} onClick={() => void act(p.id, false)}>Reject</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Drive "Call Recordings Inbox": files matched to leads by phone + call time; the rest wait for HQ. */
export function RecordingsInbox() {
  const qc = useQueryClient();
  const get = useServerFn(getRecordingsInbox);
  const create = useServerFn(createRecordingsFolder);
  const sync = useServerFn(syncRecordingsFolder);
  const link = useServerFn(linkRecordingFile);
  const q = useQuery({ queryKey: ["recordings-inbox"], queryFn: () => get({ data: { token: getAdminToken() } }) });
  const [busy, setBusy] = useState(false);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const refresh = () => qc.invalidateQueries({ queryKey: ["recordings-inbox"] });
  const run = async (fn: () => Promise<unknown>, ok: (r: never) => string) => {
    setBusy(true);
    try { toast.success(ok((await fn()) as never)); await refresh(); } catch (e) { err(e); } finally { setBusy(false); }
  };
  const t = { data: { token: getAdminToken() } };
  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Call recordings from Google Drive</h2>
        {q.data?.folder ? (
          <span className="flex gap-2">
            <a href={q.data.folder.url} target="_blank" rel="noreferrer" className={`${btn} border border-primary text-primary`}>Open folder</a>
            <button className={`${btn} bg-primary text-primary-foreground`} disabled={busy} onClick={() => void run(() => sync(t), (r: { scanned: number; matched: number; unmatched: number }) => `${r.matched} linked to leads, ${r.unmatched} need review`)}>{busy ? "Checking…" : "Check folder now"}</button>
          </span>
        ) : q.data ? (
          <button className={`${btn} bg-primary text-primary-foreground`} disabled={busy} onClick={() => void run(() => create(t), () => "Folder created in Google Drive")}>Create recordings folder</button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">Drop audio files in the folder. Put the customer's phone number in the file name (e.g. 01712345678_2026-10-15.m4a) — the CRM links it to that lead and the closest call. Files are never moved or deleted.</p>
      {q.isError ? <p className="mt-2 text-sm text-destructive">{(q.error as Error).message}</p> : null}
      <ul className="mt-3 space-y-2">
        {q.data?.files.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2 text-sm">
            <span>
              {f.drive_link ? <a href={f.drive_link} target="_blank" rel="noreferrer" className="underline">{f.file_name}</a> : f.file_name}
              {" · "}{f.lead_name ? <b>{f.lead_name}</b> : <span className="text-destructive">Needs review</span>}
              {f.call_recording_id ? <span className="text-xs text-muted-foreground"> · matched to call</span> : null}
            </span>
            {f.status === "unmatched" ? (
              <span className="flex gap-2">
                <input aria-label="Lead phone" placeholder="Lead phone" value={phones[f.id] ?? ""} onChange={(e) => setPhones({ ...phones, [f.id]: e.target.value })} className="w-36 rounded-md border border-border bg-background px-2 py-1 text-xs" />
                <button className={`${btn} bg-primary text-primary-foreground`} disabled={busy || (phones[f.id] ?? "").length < 10} onClick={() => void run(() => link({ data: { token: getAdminToken(), id: f.id, phone: phones[f.id]! } }), () => "Linked to lead")}>Link</button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
