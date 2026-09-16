import { createFileRoute } from "@tanstack/react-router";

/**
 * Built-in payments webhook receiver (test + live, picked from ?env=).
 * Verifies the provider signature on every request, then mirrors the
 * subscription state into public.subscriptions. The workspace licence lives
 * there — the CRM has one floor-wide licence, not per-user billing.
 */
export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const envParam = url.searchParams.get("env");
        if (envParam !== "sandbox" && envParam !== "live") {
          return new Response("Unknown environment", { status: 400 });
        }

        const { EventName, verifyWebhook } = await import("@/lib/paddle.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let event: Awaited<ReturnType<typeof verifyWebhook>>;
        try {
          event = await verifyWebhook(request, envParam);
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }

        type SubPayload = {
          id: string;
          customer_id: string;
          status: string;
          items?: { price?: { id?: string; product_id?: string }; quantity?: number }[];
          current_billing_period?: { starts_at?: string; ends_at?: string } | null;
          scheduled_change?: { action?: string } | null;
          custom_data?: { buyer_email?: string } | null;
        };

        if (
          event.eventType === EventName.SubscriptionCreated ||
          event.eventType === EventName.SubscriptionUpdated ||
          event.eventType === EventName.SubscriptionCanceled ||
          event.eventType === EventName.SubscriptionActivated
        ) {
          const sub = event.data as unknown as SubPayload;
          const firstItem = sub.items?.[0];
          const row = {
            paddle_subscription_id: sub.id,
            paddle_customer_id: sub.customer_id,
            product_id: firstItem?.price?.product_id ?? "unknown",
            price_id: firstItem?.price?.id ?? "unknown",
            seats: firstItem?.quantity ?? 1,
            status: sub.status,
            current_period_start: sub.current_billing_period?.starts_at ?? null,
            current_period_end: sub.current_billing_period?.ends_at ?? null,
            cancel_at_period_end: sub.scheduled_change?.action === "cancel",
            buyer_email: sub.custom_data?.buyer_email ?? null,
            environment: envParam,
            updated_at: new Date().toISOString(),
          };
          const { error } = await supabaseAdmin
            .from("subscriptions")
            .upsert(row, { onConflict: "paddle_subscription_id" });
          if (error) {
            console.error("subscription upsert failed", error);
            return new Response("Store failed", { status: 500 });
          }
        } else {
          console.log("Unhandled payment event:", event.eventType);
        }

        return new Response("ok");
      },
    },
  },
});
