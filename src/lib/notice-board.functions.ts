import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { noticeDecision, type NoticeAction } from "@/lib/notice-board-access";

const Base = z.object({ adminToken: z.string().nullable().optional() });

async function callerFor(adminToken: string | null | undefined, action: NoticeAction = "reply") {
  const { resolveCaller } = await import("@/lib/access.server");
  const caller = await resolveCaller(adminToken ?? null);
  const decision = noticeDecision(caller, action);
  if (decision.kind === "deny" && !(caller.scope === "authority" && caller.readOnly && ["publish", "recipients"].includes(action))) throw new Error(decision.message);
  return caller;
}

async function accessibleNoticeIds(caller: Awaited<ReturnType<typeof callerFor>>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (caller.scope === "authority") {
    const { data } = await supabaseAdmin.from("it_notices").select("id").order("published_at", { ascending: false }).limit(100);
    return (data ?? []).map((row) => row.id);
  }
  if (!caller.profile) return [];
  const { data } = await supabaseAdmin
    .from("it_notice_recipients")
    .select("notice_id")
    .eq("profile_id", caller.profile.id)
    .limit(100);
  return (data ?? []).map((row) => row.notice_id);
}

export const listNoticeBoard = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    // Signed-out, pending, or LeadHub-only sessions simply see no notices.
    if (noticeDecision(caller, "list").kind === "empty") return { canPublish: false, profileId: null, notices: [] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const noticeIds = await accessibleNoticeIds(caller);
    const now = new Date().toISOString();
    const [{ data: notices, error }, { data: receipts }, { data: replies }] = await Promise.all([
      noticeIds.length
        ? supabaseAdmin
            .from("it_notices")
            .select("*")
            .in("id", noticeIds)
            .or(`expires_at.is.null,expires_at.gt.${now}`)
            .order("published_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      noticeIds.length
        ? supabaseAdmin.from("it_notice_recipients").select("notice_id, profile_id, read_at").in("notice_id", noticeIds)
        : Promise.resolve({ data: [] }),
      noticeIds.length
        ? supabaseAdmin.from("it_notice_replies").select("id, notice_id, profile_id, author_label, body, created_at").in("notice_id", noticeIds).order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);
    if (error) throw new Error(error.message);
    const profileId = caller.profile?.id ?? null;
    return {
      canPublish: caller.scope === "authority",
      profileId,
      notices: (notices ?? []).map((notice) => {
        const delivery = (receipts ?? []).filter((row) => row.notice_id === notice.id);
        return {
          ...notice,
          read: profileId ? Boolean(delivery.find((row) => row.profile_id === profileId)?.read_at) : true,
          recipientCount: delivery.length,
          readCount: delivery.filter((row) => row.read_at).length,
          receipts: caller.scope === "authority" ? delivery : delivery.filter(row => row.profile_id === profileId),
          replies: (replies ?? []).filter((row) => row.notice_id === notice.id),
        };
      }),
    };
  });

export const listNoticeRecipients = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.parse(input ?? {}))
  .handler(async ({ data }) => {
    await callerFor(data.adminToken, "recipients");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, name, employee_id, role")
      .eq("approval_status", "approved")
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return profiles ?? [];
  });

export const publishNotice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({
      requestId: z.string().uuid().optional(),
      expiresAt: z.string().datetime().nullable().optional(),
      title: z.string().trim().min(2).max(160),
      body: z.string().trim().min(2).max(4000),
      severity: z.enum(["info", "important", "urgent"]),
      audienceType: z.enum(["all", "role", "accounts"]),
      audienceRole: z.enum(["admin", "team_leader", "agent"]).nullable().optional(),
      profileIds: z.array(z.string().uuid()).max(500).default([]),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const caller = await callerFor(data.adminToken, "publish");
    if (data.audienceType === "role" && !data.audienceRole) throw new Error("প্রাপক role বাছুন");
    if (data.audienceType === "accounts" && data.profileIds.length === 0) throw new Error("কমপক্ষে একটি অ্যাকাউন্ট বাছুন");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let recipients = supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("approval_status", "approved")
      .eq("is_active", true);
    if (data.audienceType === "role" && data.audienceRole) recipients = recipients.eq("role", data.audienceRole);
    if (data.audienceType === "accounts") recipients = recipients.in("id", data.profileIds);
    const { data: profiles, error: recipientError } = await recipients;
    if (recipientError) throw new Error(recipientError.message);
    if (!profiles?.length) throw new Error("কোনো সক্রিয় প্রাপক পাওয়া যায়নি");

    const label = caller.readOnly ? "Executive HQ" : (caller.profile?.name ?? "IT Council");
    const result = await supabaseAdmin.rpc("publish_notice_atomic", {
      _request: data.requestId ?? crypto.randomUUID(), _title: data.title, _body: data.body, _severity: data.severity,
      _audience: data.audienceType, _role: data.audienceType === "role" ? data.audienceRole ?? null : null,
      _recipients: profiles.map(p => p.id), _author: caller.profile?.id ?? null, _label: label, _expiry: data.expiresAt ?? null,
    });
    if (result.error || !result.data) throw new Error("Message publication could not be confirmed");
    const notice = { id: result.data };
    try {
      const { sendPush } = await import("@/lib/push.server");
      await sendPush({
        eventKey: `it_notice:${notice.id}`,
        kind: "it_notice",
        entityId: notice.id,
        profileIds: profiles.map((profile) => profile.id),
        payload: { title: data.title, body: data.body, path: "/desk", data: { notice_id: notice.id } },
      });
    } catch (pushError) {
      console.error("IT notice push pending:", pushError);
    }
    return { id: notice.id, recipients: profiles.length };
  });

export const markNoticeRead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.extend({ noticeId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const caller = await callerFor(data.adminToken, "read");
    if (!caller.profile) return { ok: true };
    const ids = await accessibleNoticeIds(caller);
    if (!ids.includes(data.noticeId)) throw new Error("এই নোটিশ দেখার অনুমতি নেই");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("it_notice_recipients")
      .update({ read_at: new Date().toISOString() })
      .eq("notice_id", data.noticeId)
      .eq("profile_id", caller.profile.id)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const replyToNotice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.extend({ noticeId: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).parse(input))
  .handler(async ({ data }) => {
    const caller = await callerFor(data.adminToken, "reply");
    const ids = await accessibleNoticeIds(caller);
    if (!ids.includes(data.noticeId)) throw new Error("এই নোটিশে উত্তর দেওয়ার অনুমতি নেই");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("it_notice_replies").insert({
      notice_id: data.noticeId,
      profile_id: caller.profile?.id ?? null,
      author_label: caller.profile?.name ?? "IT Council",
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });