import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { AUDIT_COMMIT, AUDIT_DATE, AUDIT_ITEMS, DOC_VERSION } from "@/lib/handover-docs";

/**
 * Persisted audit findings + append-only remediation timeline.
 * Server-only tables; HQ and IT (authority scope) read and append; nobody can
 * edit or delete (DB trigger). Signed-out visitors of the public report get
 * nothing from these functions.
 */
export const REMEDIATION_ACTIONS = ["noted", "in_progress", "fixed", "verified", "reopened", "wont_fix"] as const;
const Token = z.string().nullable().optional();

export const findingKey = (itemNo: string) => `${AUDIT_COMMIT}#${itemNo}`;

async function authority(adminToken: string | null | undefined) {
  const { resolveCaller } = await import("@/lib/access.server");
  const c = await resolveCaller(adminToken ?? null, { skipMaintenance: true });
  if (c.scope !== "authority") return null;
  const actor = c.profile?.name ?? (c.readOnly ? "Executive HQ" : "IT Console");
  return { actor, scope: c.profile ? "admin" : c.readOnly ? "hq" : "it" };
}

export const getAuditRecords = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const a = await authority(data.adminToken);
    if (!a) return { allowed: false as const, persisted: [], events: [] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [f, e] = await Promise.all([
      supabaseAdmin.from("audit_findings").select("finding_key, item_no, captured_by, captured_at").eq("audit_commit", AUDIT_COMMIT),
      supabaseAdmin.from("audit_remediation_events").select("id, finding_key, action, note, actor_name, actor_scope, created_at")
        .like("finding_key", `${AUDIT_COMMIT}#%`).order("created_at", { ascending: true }).limit(2000),
    ]);
    if (f.error || e.error) throw new Error("অডিট রেকর্ড পড়া যায়নি");
    return { allowed: true as const, persisted: f.data ?? [], events: e.data ?? [] };
  });

/** Snapshots the current documented findings permanently (idempotent). */
export const persistAuditFindings = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const a = await authority(data.adminToken);
    if (!a) throw new Error("শুধু HQ/IT ফাইন্ডিং স্থায়ী করতে পারে");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = AUDIT_ITEMS.map((i) => {
      const no = i.item.match(/^(\d+)\./)?.[1] ?? i.item;
      return {
        finding_key: findingKey(no), item_no: no, title: i.item.replace(/^\d+\.\s*/, ""),
        result: i.result, evidence: i.evidence, audit_date: AUDIT_DATE, audit_commit: AUDIT_COMMIT,
        doc_version: DOC_VERSION, captured_by: a.actor,
      };
    });
    const { error } = await supabaseAdmin.from("audit_findings").upsert(rows, { onConflict: "finding_key", ignoreDuplicates: true });
    if (error) throw new Error("ফাইন্ডিং সংরক্ষণ হয়নি");
    return { ok: true, count: rows.length };
  });

export const addRemediationEvent = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      adminToken: Token,
      itemNo: z.string().min(1).max(10),
      action: z.enum(REMEDIATION_ACTIONS),
      note: z.string().trim().min(1).max(1000),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const a = await authority(data.adminToken);
    if (!a) throw new Error("শুধু HQ/IT সমাধানের ধাপ লিখতে পারে");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const key = findingKey(data.itemNo);
    const { data: f } = await supabaseAdmin.from("audit_findings").select("finding_key").eq("finding_key", key).maybeSingle();
    if (!f) throw new Error("আগে ফাইন্ডিংগুলো স্থায়ী করুন");
    const { error } = await supabaseAdmin.from("audit_remediation_events").insert({
      finding_key: key, action: data.action, note: data.note, actor_name: a.actor, actor_scope: a.scope,
    });
    if (error) throw new Error("ধাপ সংরক্ষণ হয়নি");
    return { ok: true };
  });
