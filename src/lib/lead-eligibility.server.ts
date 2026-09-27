export type LeadPhoneStatus = {
  canonicalPhones: string[];
  existingLeadId: string | null;
  alreadyWorked: boolean;
};

export async function getLeadPhoneStatus(raw: string): Promise<LeadPhoneStatus> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("lead_phone_status", { _raw: raw });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return {
    canonicalPhones: row?.canonical_phones ?? [],
    existingLeadId: row?.existing_lead_id ?? null,
    alreadyWorked: row?.already_worked ?? false,
  };
}

/**
 * The one answer to "do we already have this number?".
 *
 * The phone-key index answers it instantly for every lead created through the
 * CRM. A lead that arrived before the index existed (or whose key row was lost)
 * would otherwise look brand new and get a second copy, so the number is also
 * matched against the lead list itself and the missing key is written back —
 * after that the unique index keeps the number single forever.
 */
export async function resolveLeadIdByPhone(
  raw: string,
  /**
   * The agent this call belongs to. The same number can exist on more than one
   * lead card (imports in different formats, older duplicates), so when this
   * agent already owns a card for the number, their own card is the one the call
   * and its report attach to — never a colleague's.
   */
  preferAgentId?: string | null,
): Promise<LeadPhoneStatus> {
  const status = await getLeadPhoneStatus(raw);
  if (status.canonicalPhones.length === 0) return status;
  if (status.existingLeadId && !preferAgentId) return status;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { extractBangladeshPhones } = await import("@/lib/lead-phone");
  // The last 9 digits are the same in every Bangladeshi format of one number.
  const filter = status.canonicalPhones
    .map((phone) => `phone_number.ilike.%${phone.slice(-9)}%`)
    .join(",");
  const { data: candidates } = await supabaseAdmin
    .from("leads")
    .select("id, phone_number, created_at, assigned_agent_id, assigned_to")
    .or(filter)
    .order("created_at", { ascending: true })
    .limit(50);

  const sameNumber = (candidates ?? []).filter((lead) =>
    extractBangladeshPhones(lead.phone_number ?? "").some((phone) =>
      status.canonicalPhones.includes(phone),
    ),
  );
  const ownByAgent = preferAgentId
    ? sameNumber.find(
        (lead) =>
          lead.assigned_agent_id === preferAgentId || lead.assigned_to === preferAgentId,
      )
    : undefined;

  if (status.existingLeadId) {
    // The index already knows the number: only an own-card match may override it.
    if (!ownByAgent || ownByAgent.id === status.existingLeadId) return status;
    const { data: worked } = await supabaseAdmin.rpc("lead_has_work_history", {
      _lead_id: ownByAgent.id,
    });
    return {
      canonicalPhones: status.canonicalPhones,
      existingLeadId: ownByAgent.id,
      alreadyWorked: Boolean(worked) || status.alreadyWorked,
    };
  }

  const match = ownByAgent ?? sameNumber[0];
  if (!match) return status;

  for (const phone of extractBangladeshPhones(match.phone_number ?? "")) {
    await supabaseAdmin
      .from("lead_phone_keys")
      .upsert({ canonical_phone: phone, lead_id: match.id }, { onConflict: "canonical_phone", ignoreDuplicates: true });
  }

  const { data: worked } = await supabaseAdmin.rpc("lead_has_work_history", { _lead_id: match.id });
  return {
    canonicalPhones: status.canonicalPhones,
    existingLeadId: match.id,
    alreadyWorked: Boolean(worked) || status.alreadyWorked,
  };
}

export async function eligibleLeadIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Checked in batches: one call over thousands of pool leads hits the
  // database statement timeout (broke IT Console notices once the pool grew).
  const CHUNK = 300;
  const out: string[] = [];
  for (let i = 0; i < ids.length; i += CHUNK * 4) {
    const batches = [];
    for (let j = i; j < Math.min(ids.length, i + CHUNK * 4); j += CHUNK) {
      batches.push(
        supabaseAdmin.rpc("filter_eligible_lead_ids", { _lead_ids: ids.slice(j, j + CHUNK) }),
      );
    }
    for (const { data, error } of await Promise.all(batches)) {
      if (error) throw new Error(error.message);
      (data ?? []).forEach((row) => out.push(row.lead_id));
    }
  }
  return out;
}