import { readFileSync } from "node:fs";
const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
const { primaryBangladeshPhone } = await import("@/lib/lead-phone");
const rows = JSON.parse(readFileSync("/tmp/smart-leads.json", "utf8"));
const phones = [...new Set(rows.map((r: any) => primaryBangladeshPhone(r.phone)).filter(Boolean))] as string[];
console.log("sheet unique phones:", phones.length);
const existing = new Set<string>();
for (let i = 0; i < phones.length; i += 500) {
  const batch = phones.slice(i, i + 500);
  const { data, error } = await supabaseAdmin.from("lead_phone_keys").select("canonical_phone").in("canonical_phone", batch);
  if (error) { console.log("err", error.message); break; }
  (data ?? []).forEach((k: any) => existing.add(k.canonical_phone));
}
console.log("already in CRM (key index):", existing.size, "of", phones.length);
const { count: headCount } = await supabaseAdmin.from("leads").select("id", { count: "exact", head: true }).eq("source", "head_database");
console.log("head_database leads:", headCount);
const { count: headUnassigned } = await supabaseAdmin.from("leads").select("id", { count: "exact", head: true }).eq("source", "head_database").is("assigned_to", null);
console.log("head_database unassigned:", headUnassigned);
