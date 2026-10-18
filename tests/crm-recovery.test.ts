import { beforeEach, expect, it, vi } from "vitest";
import { normalizeLeadPhone } from "@/lib/lead-intake.server";
import { summarize } from "@/lib/lead360";
const s = vi.hoisted(() => ({ fail: false, status: "pending", finalizes: [] as Record<string, unknown>[], writes: 0 }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
 from(table: string) { const q: Record<string, unknown> = {};
  for (const method of ["select","eq","maybeSingle"]) q[method] = () => q;
  q.update = () => { s.writes++; return q; };
  q.then = (resolve: (r: unknown) => void) => resolve({ data: table === "call_reports" ? { id:"r1",lead_id:"l1",agent_id:"a1",status:s.status,connected:false,duration_seconds:0,recording_id:null,device_id:null } : table === "leads" ? { unanswered_attempts:0 } : null,error:null });
  return q;
 },
 rpc: async (_name: string, args: Record<string, unknown>) => { s.finalizes.push(args); return s.fail ? {error:{message:"synthetic follow-up failure"},data:null} : {error:null,data:{alreadySubmitted:false,followUpId:"f1"}}; },
} }));
vi.mock("@/lib/call-jobs.server", () => ({ recordSyncEvent: async () => undefined }));
vi.mock("@/lib/classification-review.server", () => ({ reviewSubmittedReport: async () => ({ mismatchAlertId:null,missingRecordingAlertId:null }) }));
beforeEach(() => { s.fail=false; s.status="pending"; s.finalizes=[]; s.writes=0; });
const noAnswer = { reportId:"r1",agentId:"a1",category:"no_answer",summary:"No answer",direction:"outgoing",callStatus:"no_answer",durationSeconds:0,followUpNeeded:false,noFollowUpReason:"not_connected" };
it("international intake retains explicit country-code prefix", () => {
 expect(normalizeLeadPhone("+442079460123")).toBe("+442079460123");
 expect(normalizeLeadPhone("00442079460123")).toBe("+442079460123");
 expect(normalizeLeadPhone("01712345678")).toBe("8801712345678");
});
it("cancelled tasks are neither overdue nor completed", () => {
 const tasks=["cancelled","canceled"].map((status,id) => ({ id:String(id),agentId:"a1",scheduledAt:"2026-10-01T00:00:00Z",createdAt:"2026-09-30T00:00:00Z",status,reasonCode:"payment",note:null,completedAt:null,rescheduleCount:0 }));
 expect(summarize([],tasks,new Date("2026-10-18T00:00:00Z"))).toMatchObject({ completed:0,overdue:0,upcoming:0,current:null });
});
it("no-answer submits retry time, not a contact-close reason", async () => {
 const { submitCallReport }=await import("@/lib/call-reports.server");
 await submitCallReport(noAnswer);
 const args=s.finalizes[0]; expect(args).toBeDefined();
 const report=args?.["_report_patch"] as { follow_up_at:string; no_follow_up_reason:null };
 const followup=args?.["_followup"] as { scheduled_at:string };
 expect(report.follow_up_at).toBe(followup.scheduled_at); expect(report.no_follow_up_reason).toBeNull(); expect(s.writes).toBe(0);
});
it("transaction failure does not perform separate report/lead writes", async () => {
 s.fail=true;
 const { submitCallReport }=await import("@/lib/call-reports.server");
 await expect(submitCallReport(noAnswer)).rejects.toThrow("সেভ হয়নি");
 expect(s.writes).toBe(0); expect(s.finalizes).toHaveLength(1);
});
it("submitted replay has no effects", async () => {
 s.status="submitted";
 const { submitCallReport }=await import("@/lib/call-reports.server");
 expect(await submitCallReport(noAnswer)).toMatchObject({alreadySubmitted:true}); expect(s.finalizes).toHaveLength(0); expect(s.writes).toBe(0);
});