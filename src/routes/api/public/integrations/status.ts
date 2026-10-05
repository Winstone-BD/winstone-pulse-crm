import { createFileRoute } from "@tanstack/react-router";

const has = (n: string) => Boolean(process.env[n]);

/** Integration diagnostics: presence/shape flags only, never values. */
export const Route = createFileRoute("/api/public/integrations/status")({
  server: {
    handlers: {
      GET: async () => {
        const ep = process.env["OS_BOOKING_ENDPOINT"] ?? "";
        const body = {
          os_outbound: {
            endpoint_configured: Boolean(ep),
            endpoint_https: ep.startsWith("https://"),
            signing_secret_configured: has("CRM_BRIDGE_SECRET"),
          },
          os_inbound: { path: "/api/public/os/events", secret_configured: has("CRM_BRIDGE_SECRET") },
          hostinger_inbound: {
            path: "/api/public/email-events",
            secret_configured: has("HOSTINGER_EMAIL_WEBHOOK_SECRET"),
          },
          hostinger_outbound: {
            transport: "https://api.mail.hostinger.com",
            sender: "info@winstonebd.com",
            api_key_configured: has("NOTIFY_EMAIL_API_KEY"),
            approver_configured: has("SERVICE_BILL_APPROVER_EMAIL"),
          },
        };
        return new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      },
    },
  },
});
