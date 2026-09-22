/**
 * Per-version data guarantee.
 *
 * Every lead and every post-call report that arrives from a phone is recorded
 * here together with the app version that produced it and a snapshot of what
 * was sent. When an agent's phone moves to a new app version — or a version is
 * dropped/replaced — the new version can ask for everything the old version
 * captured and get it handed back, so no offline work is ever stranded on a
 * retired build.
 */

export type VersionEntity = "lead" | "report";

type RecordInput = {
  entityType: VersionEntity;
  entityId: string;
  appVersion?: string | null;
  versionCode?: number | null;
  deviceId?: string | null;
  agentId?: string | null;
  employeeId?: string | null;
  clientRef?: string | null;
  capturedOffline?: boolean;
  createdOfflineAt?: string | null;
  payload?: Record<string, unknown>;
};

/**
 * Fire-and-forget: the ledger must never break a sync. One row per entity,
 * so a retried offline upload cannot create duplicates.
 */
export async function recordVersionData(input: RecordInput): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("version_data_ledger")
      .upsert(
        {
          entity_type: input.entityType,
          entity_id: input.entityId,
          app_version: input.appVersion ?? null,
          version_code: input.versionCode ?? null,
          device_id: input.deviceId ?? null,
          agent_id: input.agentId ?? null,
          employee_id: input.employeeId ?? null,
          client_ref: input.clientRef ?? null,
          captured_offline: input.capturedOffline ?? false,
          created_offline_at: input.createdOfflineAt ?? null,
          payload: (input.payload ?? {}) as never,
        },
        { onConflict: "entity_type,entity_id" },
      );
    if (error) console.error(`version ledger write failed: ${error.message}`);
  } catch (cause) {
    console.error("version ledger write threw", cause);
  }
}

export type HandoffItem = {
  ledgerId: string;
  entityType: VersionEntity;
  entityId: string;
  appVersion: string | null;
  versionCode: number | null;
  capturedOffline: boolean;
  createdOfflineAt: string | null;
  syncedAt: string;
  payload: Record<string, unknown>;
  detail: Record<string, unknown> | null;
};

/**
 * Everything this agent's earlier app versions captured that the version now
 * running has not yet been handed. Includes the live row from the CRM, so the
 * phone shows current truth rather than a stale offline copy.
 */
export async function readVersionHandoff(params: {
  agentId: string;
  versionCode: number | null;
  limit?: number;
}): Promise<{ items: HandoffItem[]; fromVersions: number[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const limit = Math.min(Math.max(params.limit ?? 200, 1), 500);

  let query = supabaseAdmin
    .from("version_data_ledger")
    .select(
      "id, entity_type, entity_id, app_version, version_code, captured_offline, created_offline_at, synced_at, payload, restored_version_code",
    )
    .eq("agent_id", params.agentId)
    .order("synced_at", { ascending: false })
    .limit(limit);

  if (params.versionCode != null) {
    // Pending = never restored, or restored only into an older version.
    query = query.or(
      `restored_version_code.is.null,restored_version_code.lt.${params.versionCode}`,
    );
  } else {
    query = query.is("restored_at", null);
  }

  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);

  const pending = (rows ?? []).filter(
    (row) => params.versionCode == null || row.version_code == null || row.version_code < params.versionCode,
  );
  if (!pending.length) return { items: [], fromVersions: [] };

  const leadIds = pending.filter((r) => r.entity_type === "lead").map((r) => r.entity_id);
  const reportIds = pending.filter((r) => r.entity_type === "report").map((r) => r.entity_id);

  const [{ data: leads }, { data: reports }] = await Promise.all([
    leadIds.length
      ? supabaseAdmin
          .from("leads")
          .select("id, name, phone_number, company, notes, status, work_state, work_date, temperature, grade")
          .in("id", leadIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    reportIds.length
      ? supabaseAdmin
          .from("call_reports")
          .select(
            "id, lead_id, phone_number, status, category, summary, note, reason, follow_up_at, connected, duration_seconds, call_ended_at, temperature, grade",
          )
          .in("id", reportIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const leadById = new Map((leads ?? []).map((l) => [String(l.id), l as Record<string, unknown>]));
  const reportById = new Map((reports ?? []).map((r) => [String(r.id), r as Record<string, unknown>]));

  const items: HandoffItem[] = pending.map((row) => ({
    ledgerId: row.id,
    entityType: row.entity_type as VersionEntity,
    entityId: row.entity_id,
    appVersion: row.app_version,
    versionCode: row.version_code,
    capturedOffline: row.captured_offline,
    createdOfflineAt: row.created_offline_at,
    syncedAt: row.synced_at,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    detail:
      row.entity_type === "lead"
        ? leadById.get(row.entity_id) ?? null
        : reportById.get(row.entity_id) ?? null,
  }));

  const fromVersions = [
    ...new Set(items.map((i) => i.versionCode).filter((v): v is number => v != null)),
  ].sort((a, b) => a - b);

  return { items, fromVersions };
}

/** The new version confirms it now holds these rows. */
export async function markVersionHandoffRestored(params: {
  agentId: string;
  ledgerIds: string[];
  versionCode: number | null;
}): Promise<number> {
  if (!params.ledgerIds.length) return 0;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("version_data_ledger")
    .update({ restored_at: new Date().toISOString(), restored_version_code: params.versionCode })
    .eq("agent_id", params.agentId)
    .in("id", params.ledgerIds)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

export type VersionCoverageRow = {
  versionCode: number | null;
  appVersion: string | null;
  leads: number;
  reports: number;
  offlineCaptured: number;
  pendingHandoff: number;
  restored: number;
  firstSyncAt: string | null;
  lastSyncAt: string | null;
};

/** IT Console: what each app version produced, and what is still owed back. */
export async function readVersionCoverage(windowDays = 90): Promise<{
  versions: VersionCoverageRow[];
  totals: { leads: number; reports: number; pendingHandoff: number; offlineCaptured: number };
  pendingByAgent: { agentId: string; agentName: string | null; pending: number; versions: number[] }[];
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("version_data_ledger")
    .select(
      "entity_type, app_version, version_code, captured_offline, synced_at, restored_at, agent_id",
    )
    .gte("synced_at", since)
    .order("synced_at", { ascending: false })
    .limit(20000);
  if (error) throw new Error(error.message);

  const byVersion = new Map<string, VersionCoverageRow>();
  const pendingAgents = new Map<string, { pending: number; versions: Set<number> }>();
  const totals = { leads: 0, reports: 0, pendingHandoff: 0, offlineCaptured: 0 };

  for (const row of rows ?? []) {
    const key = String(row.version_code ?? "unknown");
    const entry =
      byVersion.get(key) ??
      ({
        versionCode: row.version_code,
        appVersion: row.app_version,
        leads: 0,
        reports: 0,
        offlineCaptured: 0,
        pendingHandoff: 0,
        restored: 0,
        firstSyncAt: row.synced_at,
        lastSyncAt: row.synced_at,
      } satisfies VersionCoverageRow);

    if (row.entity_type === "lead") {
      entry.leads += 1;
      totals.leads += 1;
    } else {
      entry.reports += 1;
      totals.reports += 1;
    }
    if (row.captured_offline) {
      entry.offlineCaptured += 1;
      totals.offlineCaptured += 1;
    }
    if (row.restored_at) entry.restored += 1;
    else {
      entry.pendingHandoff += 1;
      totals.pendingHandoff += 1;
      if (row.agent_id) {
        const agent = pendingAgents.get(row.agent_id) ?? { pending: 0, versions: new Set<number>() };
        agent.pending += 1;
        if (row.version_code != null) agent.versions.add(row.version_code);
        pendingAgents.set(row.agent_id, agent);
      }
    }
    if (!entry.appVersion && row.app_version) entry.appVersion = row.app_version;
    if (row.synced_at < (entry.firstSyncAt ?? row.synced_at)) entry.firstSyncAt = row.synced_at;
    if (row.synced_at > (entry.lastSyncAt ?? row.synced_at)) entry.lastSyncAt = row.synced_at;
    byVersion.set(key, entry);
  }

  const agentIds = [...pendingAgents.keys()];
  const { data: profiles } = agentIds.length
    ? await supabaseAdmin.from("profiles").select("id, name").in("id", agentIds)
    : { data: [] as { id: string; name: string | null }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

  return {
    versions: [...byVersion.values()].sort((a, b) => (b.versionCode ?? -1) - (a.versionCode ?? -1)),
    totals,
    pendingByAgent: agentIds
      .map((id) => ({
        agentId: id,
        agentName: nameById.get(id) ?? null,
        pending: pendingAgents.get(id)!.pending,
        versions: [...pendingAgents.get(id)!.versions].sort((a, b) => a - b),
      }))
      .sort((a, b) => b.pending - a.pending),
  };
}

/**
 * "Hand this version's data back again": clears the restored mark so the
 * affected phones receive the rows on their next handoff check. Used when a
 * version is dropped or a reinstall loses local data.
 */
export async function replayVersionData(params: {
  versionCode?: number | null;
  agentId?: string | null;
}): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let query = supabaseAdmin
    .from("version_data_ledger")
    .update({ restored_at: null, restored_version_code: null });
  if (params.versionCode != null) query = query.eq("version_code", params.versionCode);
  if (params.agentId) query = query.eq("agent_id", params.agentId);
  else if (params.versionCode == null) throw new Error("Choose a version or an agent to replay");
  const { data, error } = await query.select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}
