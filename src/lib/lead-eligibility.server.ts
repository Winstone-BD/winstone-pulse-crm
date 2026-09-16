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

export async function eligibleLeadIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("filter_eligible_lead_ids", { _lead_ids: ids });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.lead_id);
}