import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/agent/notices")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { resolveApiCaller, json, unauthorized } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind !== "device") return unauthorized();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: deliveries, error } = await supabaseAdmin
          .from("it_notice_recipients")
          .select("notice_id, read_at")
          .eq("profile_id", caller.profile.id)
          .limit(50);
        if (error) return json({ error: error.message }, 500);
        const ids = (deliveries ?? []).map((row) => row.notice_id);
        if (!ids.length) return json({ notices: [] });
        const { data: notices, error: noticeError } = await supabaseAdmin
          .from("it_notices")
          .select("id, title, body, severity, author_label, published_at, expires_at")
          .in("id", ids)
          .order("published_at", { ascending: false });
        if (noticeError) return json({ error: noticeError.message }, 500);
        const now = Date.now();
        return json({ notices: (notices ?? []).filter((row) => !row.expires_at || Date.parse(row.expires_at) > now) });
      },
    },
  },
});