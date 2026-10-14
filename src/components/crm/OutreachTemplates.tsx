import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { getAdminToken } from "@/lib/local-session";
import { normalizeWhatsAppNumber, openWhatsApp } from "@/lib/whatsapp";
import { logWhatsappHandoff } from "@/lib/whatsapp.functions";
import { leadProjectLabel } from "@/lib/site-visits.functions";

/**
 * One-tap Bengali outreach templates. Text is filled only with real lead data
 * (name, project if known); prices/links are never invented — the agent
 * attaches the actual brochure or price sheet in WhatsApp. Opens WhatsApp or
 * the phone's SMS app (agent's own SIM) and logs the hand-off on the lead.
 */
type Ctx = { name: string; project?: string | null; agentName?: string | null };

export const OUTREACH_TEMPLATES: { key: string; label: string; build: (c: Ctx) => string }[] = [
  {
    key: "brochure", label: "ব্রোশিওর",
    build: (c) => `আসসালামু আলাইকুম ${c.name}, উইনস্টোন থেকে বলছি${c.agentName ? ` (${c.agentName})` : ""}। আপনার আগ্রহ অনুযায়ী ${c.project ? `"${c.project}" প্রজেক্টের` : "আমাদের প্রজেক্টের"} ব্রোশিওর পাঠাচ্ছি। কোনো প্রশ্ন থাকলে জানাবেন।`,
  },
  {
    key: "visit_invite", label: "সাইট ভিজিট আমন্ত্রণ",
    build: (c) => `আসসালামু আলাইকুম ${c.name}, ${c.project ? `"${c.project}"` : "আমাদের প্রজেক্ট"} সরেজমিনে দেখতে আপনাকে সাইট ভিজিটে আমন্ত্রণ জানাচ্ছি। আপনার সুবিধামতো দিন ও সময় জানালে আমরা ব্যবস্থা করব। — উইনস্টোন`,
  },
  {
    key: "price_sheet", label: "মূল্য তালিকা",
    build: (c) => `আসসালামু আলাইকুম ${c.name}, ${c.project ? `"${c.project}" প্রজেক্টের` : "প্রজেক্টের"} হালনাগাদ মূল্য তালিকা সংযুক্ত করছি। বিস্তারিত জানতে কল করুন। — উইনস্টোন`,
  },
  {
    key: "callback", label: "কলব্যাক নিশ্চিতকরণ",
    build: (c) => `আসসালামু আলাইকুম ${c.name}, আপনার সাথে কথা বলার জন্য ধন্যবাদ। আমাদের আলোচনা অনুযায়ী আমি আবার আপনাকে কল করব। — উইনস্টোন${c.agentName ? `, ${c.agentName}` : ""}`,
  },
];

function openSms(phone: string, text: string): boolean {
  const n = normalizeWhatsAppNumber(phone);
  if (!n) return false;
  window.location.href = `sms:+${n}?body=${encodeURIComponent(text)}`;
  return true;
}

export function OutreachTemplates({ leadId, phone, name, project, agentName }: {
  leadId: string; phone: string | null | undefined; name: string; project?: string | null; agentName?: string | null;
}) {
  const lookup = useServerFn(leadProjectLabel);
  const known = useQuery({
    queryKey: ["lead-project", leadId], enabled: !project, staleTime: 5 * 60_000,
    queryFn: () => lookup({ data: { adminToken: getAdminToken(), leadId } }),
  });
  const proj = project || known.data?.project || null;
  const send = (tplKey: string, channel: "whatsapp" | "sms") => {
    const tpl = OUTREACH_TEMPLATES.find((x) => x.key === tplKey)!;
    const text = tpl.build({ name: name || "স্যার/ম্যাডাম", project: proj, agentName: agentName ?? null });
    let msisdn: string | null = null;
    if (channel === "whatsapp") {
      const r = openWhatsApp(phone, text);
      if (!r.ok) { toast.error(r.reason === "invalid_number" ? "নম্বরটি সঠিক নয়" : "পপ-আপ আটকে গেছে — অনুমতি দিন"); return; }
      msisdn = r.msisdn;
    } else {
      if (!phone || !openSms(phone, text)) { toast.error("নম্বরটি সঠিক নয় — SMS খোলা যায়নি"); return; }
      msisdn = normalizeWhatsAppNumber(phone);
    }
    void logWhatsappHandoff({ data: { adminToken: getAdminToken(), leadId, phone: msisdn ?? String(phone), note: `টেমপ্লেট: ${tpl.label}`, channel } })
      .catch((e: Error) => console.error("[outreach] log failed", e));
  };
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-muted-foreground">দ্রুত বার্তা{proj ? ` · ${proj}` : ""} (খুলে যাবে — পাঠানোর আগে দেখে নিন)</p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {OUTREACH_TEMPLATES.map((t) => (
          <div key={t.key} className="flex items-center justify-between gap-1 rounded-lg border border-border bg-card px-2 py-1.5">
            <span className="min-w-0 truncate text-xs font-medium">{t.label}</span>
            <span className="flex shrink-0 gap-1">
              <button type="button" aria-label={`${t.label} — WhatsApp`} onClick={() => send(t.key, "whatsapp")}
                className="grid size-8 place-items-center rounded-md border border-border hover:bg-muted"><MessageCircle className="size-4 text-success" /></button>
              <button type="button" aria-label={`${t.label} — SMS`} onClick={() => send(t.key, "sms")}
                className="grid size-8 place-items-center rounded-md border border-border hover:bg-muted"><MessageSquare className="size-4 text-primary" /></button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
