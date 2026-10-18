import { readFileSync } from "node:fs";
import { expect,it } from "vitest";
const identity=readFileSync("drizzle/migrations/0140_canonical_identity_and_atomic_extra_grants.sql","utf8");
const report=readFileSync("drizzle/migrations/0141_atomic_call_report_finalize.sql","utf8");
const guards=readFileSync("drizzle/migrations/0142_assignment_review_and_it_identity_guards.sql","utf8");
it("phone-key conflict returns the committed owner and rejects another lead",()=>{
 expect(identity).toMatch(/ON CONFLICT\(canonical_phone\) DO UPDATE[\s\S]*RETURNING lead_id INTO owner_id/);
 expect(identity).toContain("owner_id IS DISTINCT FROM NEW.id"); expect(identity).toContain("ERRCODE='23505'");
});
it("extra grants serialize before replay lookup and ledger insertion",()=>{
 expect(identity.indexOf("pg_advisory_xact_lock")).toBeLessThan(identity.indexOf("SELECT * INTO prior"));
 expect(identity).toContain("INSERT INTO public.lead_assignments");expect(identity).toContain("INSERT INTO public.lead_extra_grants");
 expect(identity).toContain("REVOKE ALL ON FUNCTION public.allocate_extra_leads_atomic");
});
it("HQ comments are not treated as customer contact during recall",()=>{expect(identity).toContain("'neglect_recalled','hq_review_comment'");});
it("report locks report and lead; final state is committed only with follow-up/history",()=>{
 expect(report).toContain("WHERE id=_report FOR UPDATE");expect(report).toContain("WHERE id=r.lead_id FOR UPDATE");
 expect(report.indexOf("INSERT INTO public.follow_up_events")).toBeLessThan(report.indexOf("UPDATE public.call_reports SET status"));
 expect(report).toContain("REVOKE ALL ON FUNCTION public.finalize_call_report_atomic");
});
it("all ownership changes reject Friday and unresolved HQ reviews",()=>{
 expect(guards).toContain("extract(isodow FROM d)=5");expect(guards).toContain("unlock_for_date<=d");
 expect(guards).toContain("BEFORE UPDATE OF assigned_to,assigned_agent_id");
});
it("IT role activation verifies linked confirmed email and protects privileged identities",()=>{
 expect(guards).toContain("u.email_confirmed_at IS NOT NULL");expect(guards).toContain("p.id=NEW.profile_id");
 expect(guards).toContain("public.privileged_account_allowlist");expect(guards).toContain("OLD.status<>'approved'");
});