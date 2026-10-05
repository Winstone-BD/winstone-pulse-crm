import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Public-safe status only; contains no CRM, customer, account or device data. */
export const Route = createFileRoute("/api/public/config/maintenance")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("app_config")
          .select("data")
          .eq("id", "default")
          .maybeSingle();
        const saved = data?.data && typeof data.data === "object"
          ? (data.data as Record<string, unknown>)["maintenance"]
          : null;
        const maintenance = saved && typeof saved === "object"
          ? (saved as Record<string, unknown>)
          : {};
        const { isLockedForOrdinaryUsers } = await import("@/lib/maintenance.server");
        if (await isLockedForOrdinaryUsers()) {
          return json({
            active: true,
            title: "🔒 SYSTEM MAINTENANCE LOCKED",
            detail:
              "Winstone CRM is temporarily unavailable because the monthly system maintenance payment ($46.29 USD) is pending. Please contact IT Console to complete payment verification and request system restoration.",
          });
        }
        return json({
          active: typeof maintenance["active"] === "boolean" ? maintenance["active"] : false,
          title:
            typeof maintenance["title"] === "string"
              ? maintenance["title"]
              : "জরুরি নোটিশ — CRM সাময়িকভাবে বন্ধ",
          detail:
            typeof maintenance["detail"] === "string"
              ? maintenance["detail"]
              : "CRM-এর ongoing development ও system update চলছে। প্রতিটি Agent-এর individual report আলাদাভাবে PDF download করার সুবিধা যোগ করা হচ্ছে। System পুনরায় active করার confirmation না পাওয়া পর্যন্ত CRM ব্যবহার করবেন না।",
        });
      },
    },
  },
});