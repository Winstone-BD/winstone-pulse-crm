import { CATEGORY_LABEL_CLIENT } from "@/lib/call-categories";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.8-flash";

export type ReportBrief = {
  brief: string;
  nextStep: string | null;
  generatedAt: string;
  cached: boolean;
};

const SYSTEM = `তুমি "Winstone CRM" সেলস CRM-এর AI সহকারী। একটি জমা দেওয়া কল রিপোর্ট পড়ে এজেন্টের জন্য সংক্ষিপ্ত বাংলা সারসংক্ষেপ লিখবে।
নিয়ম:
- শুধু দেওয়া তথ্য ব্যবহার করবে; কোনো তথ্য, নাম বা সংখ্যা কল্পনা করবে না।
- সারসংক্ষেপ সর্বোচ্চ ৩ বাক্যে, সরাসরি ও কাজের ভাষায়।
- পরবর্তী পদক্ষেপ একটি বাক্যে; কিছু করার না থাকলে null।
- টাকার অঙ্ক বাংলাদেশি টাকা (৳)।
শুধু strict JSON দেবে:
{"brief":"...","next_step":"... বা null"}`;

/**
 * Gemini brief for one submitted call report. Agent-scoped: the caller must own
 * the report. The brief is cached on the row so it is generated once per report.
 */
export async function briefCallReport(reportId: string, agentId: string): Promise<ReportBrief> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: report, error } = await supabaseAdmin
    .from("call_reports")
    .select(
      "id, agent_id, lead_id, status, category, summary, note, reason, follow_up_at, connected, duration_seconds, call_ended_at, temperature, grade, ai_brief, ai_brief_at",
    )
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!report || report.agent_id !== agentId) throw new Error("এই রিপোর্টটি আপনার নেই");
  if (report.status !== "submitted") throw new Error("রিপোর্টটি এখনো জমা হয়নি");

  if (report.ai_brief) {
    const parsed = safeParse(report.ai_brief);
    if (parsed) {
      return {
        brief: parsed.brief,
        nextStep: parsed.next_step,
        generatedAt: report.ai_brief_at ?? new Date().toISOString(),
        cached: true,
      };
    }
  }

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("name, phone_number, company, status, notes")
    .eq("id", report.lead_id)
    .maybeSingle();

  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI সার্ভিস এখন উপলব্ধ নেই");

  const evidence = {
    lead: lead
      ? {
          name: lead.name,
          company: lead.company,
          status: lead.status,
          notes: (lead.notes ?? "").slice(0, 300),
        }
      : null,
    call: {
      connected: report.connected,
      duration_seconds: report.duration_seconds,
      ended_at: report.call_ended_at,
      category: report.category
        ? (CATEGORY_LABEL_CLIENT[report.category] ?? report.category)
        : null,
      temperature: report.temperature,
      grade: report.grade,
      agent_summary: (report.summary ?? "").slice(0, 500),
      agent_note: (report.note ?? "").slice(0, 500),
      reason: report.reason,
      follow_up_at: report.follow_up_at,
    },
  };

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify(evidence) },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("report brief gateway error", res.status, detail);
    if (res.status === 402 || res.status === 403) {
      throw new Error("AI ক্রেডিট শেষ — পরে আবার চেষ্টা করুন");
    }
    throw new Error("AI সারসংক্ষেপ এখন তৈরি করা যাচ্ছে না");
  }
  const body = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  const parsed = safeParse(body.choices?.[0]?.message?.content ?? "");
  if (!parsed?.brief) throw new Error("AI সারসংক্ষেপ এখন তৈরি করা যাচ্ছে না");

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("call_reports")
    .update({ ai_brief: JSON.stringify(parsed), ai_brief_at: now })
    .eq("id", reportId);

  return { brief: parsed.brief, nextStep: parsed.next_step, generatedAt: now, cached: false };
}

function safeParse(raw: string): { brief: string; next_step: string | null } | null {
  try {
    const parsed = JSON.parse(raw) as { brief?: string; next_step?: string | null };
    if (!parsed.brief?.trim()) return null;
    return {
      brief: parsed.brief.trim(),
      next_step: parsed.next_step?.trim() ? parsed.next_step.trim() : null,
    };
  } catch {
    return null;
  }
}
