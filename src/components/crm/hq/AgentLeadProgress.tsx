import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Profile, Lead, CallRecording } from "@/lib/crm-data";
import { useLang } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import { assignedAgentLeads } from "@/lib/hq-lead-review.rules";
import { sendHqLeadReview } from "@/lib/hq-lead-review.functions";

export function AgentLeadProgress({ agents, leads, calls, loading, onOpen }: { agents: Profile[]; leads: Lead[]; calls: CallRecording[]; loading: boolean; onOpen: (id: string) => void }) {
  const lang = useLang();
  const t = (bn: string, en: string) => lang === "bn" ? bn : en;
  const [agentId, setAgentId] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const token = useAdminToken();
  const send = useServerFn(sendHqLeadReview);
  const qc = useQueryClient();
  const mutation = useMutation({ mutationFn: ({ leadId, agentId: recipient, comment: text }: { leadId: string; agentId: string; comment: string }) => send({ data: { adminToken: token, leadId, agentId: recipient, comment: text } }),
    onSuccess: () => { setComment(""); setReviewId(null); toast.success(t("রিভিউ এজেন্টের নোটিশে সেভ হয়েছে", "Review saved to the agent’s notices")); void qc.invalidateQueries({ queryKey: ["notice-board"] }); },
    onError: error => toast.error(error instanceof Error ? error.message : "Review failed"),
  });
  const assigned = agentId ? assignedAgentLeads(leads, agentId) : [];
  const filtered = assigned.filter(lead => `${lead.name} ${lead.phone_number}`.toLowerCase().includes(query.toLowerCase()));
  const rows = filtered.slice(page * 20, page * 20 + 20);
  const selected = assigned.find(lead => lead.id === reviewId);
  const fmt = (date: string) => new Date(date).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });
  const details = (lead: Lead) => {
    const history = calls.filter(call => call.lead_id === lead.id);
    const last = history.map(call => call.started_at).filter((date): date is string => Boolean(date)).sort().at(-1);
    return <><span>{history.length} {t("কল", "calls")}</span><span className="text-muted-foreground">{last ? fmt(last) : t("কল নেই", "No calls")}</span></>;
  };
  const actions = (lead: Lead) => <div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => onOpen(lead.id)}>{t("ইতিহাস", "History")}</Button><Button size="icon" variant="ghost" aria-label={t(`${lead.name} রিভিউ`, `Review ${lead.name}`)} onClick={() => { setReviewId(lead.id); setComment(""); }}><MessageSquare className="size-4" /></Button></div>;
  return <section className="space-y-4">
    <h2 className="text-lg font-semibold">{t("এজেন্টের লিড ও অগ্রগতি", "Agent leads & progress")}</h2>
    <div className="flex flex-wrap gap-2">
      <Select value={agentId} onValueChange={value => { setAgentId(value); setPage(0); setReviewId(null); }}><SelectTrigger className="w-full sm:w-72" aria-label={t("এজেন্ট", "Agent")}><SelectValue placeholder={t("এজেন্ট বাছুন", "Select agent")} /></SelectTrigger><SelectContent>{agents.map(agent => <SelectItem key={agent.id} value={agent.id}>{agent.name} · {assignedAgentLeads(leads, agent.id).length}</SelectItem>)}</SelectContent></Select>
      <Input className="w-full sm:w-64" aria-label={t("লিড খুঁজুন", "Search leads")} placeholder={t("নাম বা ফোন", "Name or phone")} value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} />
      {agentId && <span className="self-center text-sm text-muted-foreground">{assigned.length} {t("বরাদ্দ", "assigned")} · {assigned.filter(lead => lead.status === "pending").length} {t("অপেক্ষমাণ", "pending")}</span>}
    </div>
    {loading ? <p role="status">{t("লোড হচ্ছে…", "Loading…")}</p> : !agentId ? <p className="text-sm text-muted-foreground">{t("এজেন্ট বাছুন", "Select agent")}</p> : !filtered.length ? <p className="text-sm text-muted-foreground">{t("কোনো লিড নেই", "No leads")}</p> : <>
      <div className="space-y-2 md:hidden">{rows.map(lead => <article key={lead.id} className="rounded-lg border border-border p-3 space-y-2"><div className="font-medium">{lead.name}</div><div className="text-xs text-muted-foreground">{lead.phone_number} · {lead.status} · {lead.pipeline_stage}</div><div className="flex flex-wrap gap-3 text-xs">{details(lead)}</div>{actions(lead)}</article>)}</div>
      <table className="hidden w-full text-sm md:table"><thead><tr className="border-b border-border text-left text-muted-foreground"><th className="py-2">{t("লিড", "Lead")}</th><th>{t("অবস্থা / পর্যায়", "Status / stage")}</th><th>{t("কল / সর্বশেষ", "Calls / latest")}</th><th /></tr></thead><tbody>{rows.map(lead => <tr key={lead.id} className="border-b border-border"><td className="py-3"><p className="font-medium">{lead.name}</p><p className="text-xs text-muted-foreground">{lead.phone_number}</p></td><td>{lead.status} / {lead.pipeline_stage}</td><td><div className="flex flex-col gap-1 text-xs">{details(lead)}</div></td><td>{actions(lead)}</td></tr>)}</tbody></table>
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{page * 20 + 1}–{Math.min((page + 1) * 20, filtered.length)} / {filtered.length}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>{t("আগে", "Previous")}</Button><Button size="sm" variant="outline" disabled={(page + 1) * 20 >= filtered.length} onClick={() => setPage(p => p + 1)}>{t("পরে", "Next")}</Button></div></div>
    </>}
    {selected && <form className="space-y-2 border-t border-border pt-4" onSubmit={event => { event.preventDefault(); if (window.confirm(t("এই রিভিউ এজেন্টকে পাঠাবেন?", "Send this review to the agent?"))) mutation.mutate({ leadId: selected.id, agentId, comment }); }}><h3 className="font-medium">{t("রিভিউ", "Review")} · {selected.name}</h3><Textarea rows={3} maxLength={1000} value={comment} onChange={event => setComment(event.target.value)} aria-label={t("রিভিউ মন্তব্য", "Review comment")} /><div className="flex gap-2"><Button type="submit" disabled={mutation.isPending || comment.trim().length < 2}><Send className="size-4" />{t("রিভিউ পাঠান", "Send review")}</Button><Button type="button" variant="ghost" onClick={() => setReviewId(null)}>{t("বাতিল", "Cancel")}</Button></div></form>}
  </section>;
}