import { createServerFn } from "@tanstack/react-start";

import {
  CHECKLIST_STATUSES,
  DEFAULT_STATE,
  MIGRATION_CHECKLIST,
  type ChecklistState,
  type ChecklistStatus,
} from "./migration-checklist";

/**
 * Tracking state for the V1 → V2 migration checklist. Only the per-item status
 * and note are persisted — in one `system_settings` row, so no schema change is
 * needed. Authority (master PIN) only, read and write.
 */

const SETTINGS_KEY = "migration_checklist_state";

export type ChecklistStateMap = Record<string, ChecklistState>;

function sanitise(raw: unknown): ChecklistStateMap {
  const out: ChecklistStateMap = {};
  if (!raw || typeof raw !== "object") return out;
  const known = new Set(MIGRATION_CHECKLIST.map((i) => i.id));
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!known.has(id) || !value || typeof value !== "object") continue;
    const row = value as Partial<ChecklistState>;
    const status = CHECKLIST_STATUSES.includes(row.status as ChecklistStatus)
      ? (row.status as ChecklistStatus)
      : DEFAULT_STATE.status;
    out[id] = {
      status,
      note: typeof row.note === "string" ? row.note.slice(0, 1000) : "",
      updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : null,
    };
  }
  return out;
}

async function loadState(): Promise<ChecklistStateMap> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  return sanitise(data?.value);
}

export const getMigrationChecklist = createServerFn({ method: "POST" })
  .inputValidator((input: { adminToken?: string | null }) => input)
  .handler(async ({ data }): Promise<{ states: ChecklistStateMap }> => {
    const { resolveCaller, requireAuthority } = await import("./access.server");
    requireAuthority(await resolveCaller(data.adminToken ?? null));
    return { states: await loadState() };
  });

export const setMigrationChecklistItem = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      adminToken?: string | null;
      id: string;
      status?: ChecklistStatus;
      note?: string;
    }) => input,
  )
  .handler(async ({ data }): Promise<{ states: ChecklistStateMap }> => {
    const { resolveCaller, requireAuthority, requireWrite } = await import("./access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    requireAuthority(caller);
    requireWrite(caller);

    if (!MIGRATION_CHECKLIST.some((item) => item.id === data.id)) {
      throw new Error("অজানা চেকলিস্ট আইটেম");
    }

    const states = await loadState();
    const current = states[data.id] ?? DEFAULT_STATE;
    const status = CHECKLIST_STATUSES.includes(data.status as ChecklistStatus)
      ? (data.status as ChecklistStatus)
      : current.status;
    states[data.id] = {
      status,
      note: typeof data.note === "string" ? data.note.slice(0, 1000) : current.note,
      updatedAt: new Date().toISOString(),
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("system_settings").upsert(
      { key: SETTINGS_KEY, value: states as never, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
    if (error) throw new Error(`চেকলিস্ট সংরক্ষণ করা যায়নি: ${error.message}`);
    return { states };
  });
