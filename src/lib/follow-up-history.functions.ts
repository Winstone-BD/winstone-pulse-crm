import { contactCloseReasonLabel } from "@/lib/contact-close-reasons";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Follow-up history: every follow-up an agent set, every contact made on the
 * lead, and when/why contact stopped. HQ/IT read the whole floor; a signed-in
 * agent reads only their own leads. Read-only.
 */
const Input = z.object({
  adminToken: z.string().nullable().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

type Event = {
  at: string;
  kind: "follow_up_set" | "follow_up_done" | "call";
  label: string;
  detail: string | null;
};

export type FollowUpHistoryRow = {
  leadId: string;
  customer: string;
  phone: string;
  agentId: string | null;
  agentName: string;
  followUpsSet: number;
  followUpsDone: number;
  followUpsOpen: number;
  overdue: number;
  contacts: number;
  connected: number;
  firstFollowUpAt: string | null;
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  temperature: string | null;
  priority: string | null;
  state: "active" | "overdue" | "stopped";
  stoppedAt: string | null;
  stopReason: string | null;
  scheduledDays: string[];
  events: Event[];
};

const STOP_CATEGORIES = new Set(["not_interested", "wrong_number", "closed_converted"]);

async function pageAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await fetchPage(start, start + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const dhakaDay = (iso: string) =>
  new Date(new Date(iso).getTime() + 6 * 3600_000).toISOString().slice(0, 10);

export const listFollowUpHistory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    const isSupervisor = caller.scope === "authority";
    if (!isSupervisor && caller.scope !== "agent") return { rows: [], scope: "none" as const };
    const ownAgentId = isSupervisor ? null : (caller.profile?.id ?? null);
    if (!isSupervisor && !ownAgentId) return { rows: [], scope: "none" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const fromIso = data.from ? new Date(`${data.from}T00:00:00+06:00`).toISOString() : null;
    const toIso = data.to ? new Date(`${data.to}T23:59:59.999+06:00`).toISOString() : null;

    const followUps = await pageAll((a, b) => {
      let q = supabaseAdmin
        .from("follow_up_events")
        .select("id, lead_id, agent_id, customer_name, phone_number, category, priority, note, scheduled_at, status, completed_at, created_at")
        .order("created_at", { ascending: true })
        .range(a, b);
      if (ownAgentId) q = q.eq("agent_id", ownAgentId);
      if (fromIso) q = q.gte("scheduled_at", fromIso);
      if (toIso) q = q.lte("scheduled_at", toIso);
      return q;
    });

    const leadIds = [...new Set(followUps.map((f) => f.lead_id))];
    type Report = {
      lead_id: string; agent_id: string | null; call_ended_at: string; connected: boolean;
      category: string | null; reason: string | null; no_follow_up_reason: string | null; no_follow_up_note: string | null;
      customer_response: string | null; temperature: string | null; follow_up_priority: string | null; status: string;
    };
    const reports: Report[] = [];
    const leads: { id: string; name: string | null; phone_number: string | null; temperature: string | null }[] = [];
    for (let i = 0; i < leadIds.length; i += 200) {
      const ids = leadIds.slice(i, i + 200);
      const [r, l] = await Promise.all([
        pageAll((a, b) => supabaseAdmin
          .from("call_reports")
          .select("lead_id, agent_id, call_ended_at, connected, category, reason, no_follow_up_reason, no_follow_up_note, customer_response, temperature, follow_up_priority, status")
          .in("lead_id", ids)
          .eq("status", "submitted")
          .order("call_ended_at", { ascending: true })
          .order("id", { ascending: true }).range(a, b)),
        supabaseAdmin.from("leads").select("id, name, phone_number, temperature").in("id", ids),
      ]);
      if (l.error) throw new Error(l.error.message);
      reports.push(...(r as Report[]));
      leads.push(...(l.data ?? []));
    }

    const agentIds = [...new Set(followUps.map((f) => f.agent_id).filter(Boolean))] as string[];
    const { data: agents } = agentIds.length
      ? await supabaseAdmin.from("profiles").select("id, name").in("id", agentIds)
      : { data: [] as { id: string; name: string }[] };
    const agentName = new Map((agents ?? []).map((a) => [a.id, a.name]));
    const leadMap = new Map(leads.map((l) => [l.id, l]));
    const now = Date.now();

    const rows: FollowUpHistoryRow[] = leadIds.map((leadId) => {
      const fus = followUps.filter((f) => f.lead_id === leadId);
      const reps = reports.filter((r) => r.lead_id === leadId && (!ownAgentId || r.agent_id === ownAgentId));
      const lead = leadMap.get(leadId);
      const agentId = fus[fus.length - 1]?.agent_id ?? null;
      const open = fus.filter((f) => !["done", "completed", "cancelled", "canceled"].includes(f.status));
      const overdue = open.filter((f) => new Date(f.scheduled_at).getTime() < now).length;
      const nextOpen = open
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
      const last = reps[reps.length - 1];
      const stopped =
        open.length === 0 &&
        Boolean(last) &&
        (STOP_CATEGORIES.has(last!.category ?? "") || Boolean(last!.no_follow_up_reason) || !last!.follow_up_priority);
      const stopReason = stopped
        ? contactCloseReasonLabel(last!.no_follow_up_reason, last!.no_follow_up_note) || last!.reason || last!.customer_response || last!.category || "আর ফলো-আপ দেওয়া হয়নি"
        : null;

      const events: Event[] = [
        ...fus.map((f) => ({
          at: f.created_at,
          kind: "follow_up_set" as const,
          label: `ফলো-আপ সেট: ${dhakaDay(f.scheduled_at)}`,
          detail: f.note,
        })),
        ...fus.filter((f) => f.completed_at).map((f) => ({
          at: f.completed_at!,
          kind: "follow_up_done" as const,
          label: "ফলো-আপ সম্পন্ন",
          detail: null,
        })),
        ...reps.map((r) => ({
          at: r.call_ended_at,
          kind: "call" as const,
          label: r.connected ? "কল — সংযুক্ত" : "কল — সংযোগ হয়নি",
          detail: [r.category, r.reason, contactCloseReasonLabel(r.no_follow_up_reason, r.no_follow_up_note)].filter(Boolean).join(" · ") || null,
        })),
      ].sort((a, b) => a.at.localeCompare(b.at));

      return {
        leadId,
        customer: lead?.name || fus[0]?.customer_name || "—",
        phone: lead?.phone_number || fus[0]?.phone_number || "",
        agentId,
        agentName: agentId ? agentName.get(agentId) ?? "—" : "—",
        followUpsSet: fus.length,
        followUpsDone: fus.filter((f) => ["done", "completed"].includes(f.status)).length,
        followUpsOpen: open.length,
        overdue,
        contacts: reps.length,
        connected: reps.filter((r) => r.connected).length,
        firstFollowUpAt: fus[0]?.created_at ?? null,
        lastContactAt: last?.call_ended_at ?? null,
        nextFollowUpAt: nextOpen?.scheduled_at ?? null,
        temperature: last?.temperature ?? lead?.temperature ?? null,
        priority: fus[fus.length - 1]?.priority ?? null,
        state: stopped ? "stopped" : overdue > 0 ? "overdue" : "active",
        stoppedAt: stopped ? last!.call_ended_at : null,
        stopReason,
        scheduledDays: [...new Set(fus.map((f) => dhakaDay(f.scheduled_at)))],
        events,
      };
    });

    return { rows, scope: isSupervisor ? ("all" as const) : ("own" as const) };
  });
