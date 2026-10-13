import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled billing reminder: raises the current month's invoice if missing,
 * flips lapsed invoices to overdue, and alerts HQ/IT when a bill becomes due
 * or goes overdue. Caller must present the cron secret.
 */
export const Route = createFileRoute("/api/public/hooks/service-billing")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const header =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: stored } = await supabaseAdmin
          .from("system_settings")
          .select("value")
          .eq("key", "shift_cron_secret")
          .maybeSingle();
        const storedSecret =
          stored && typeof stored.value === "object" && stored.value !== null
            ? (stored.value as { secret?: string }).secret
            : undefined;

        const accepted = [
          process.env["SHIFT_CRON_SECRET"],
          process.env["LOVABLE_CRON_SECRET"],
          storedSecret,
        ].filter((value): value is string => Boolean(value));
        if (accepted.length === 0 || !header || !accepted.includes(header)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Daily (10:00 Dhaka) maintenance reminders for HQ/IT: renewal day
        // (14th) and the days before it while payment is not verified.
        // Deduped per period+day; never pays or approves anything.
        const m = await import("@/lib/maintenance.server");
        const state = await m.maintenanceAccess();
        const day = Number(
          new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", day: "numeric" }).format(new Date()),
        );
        // Daily 10:00 Dhaka run (HTTP schedule winstone-service-bill-check, 0 4 * * * UTC).
        // Calling maintenanceAccess() above also records the 15th lock exactly once.
        if (state.paymentStatus === "verified" || state.locked || day < 9 || day > 14) {
          return Response.json({ ok: true, sent: false, day, payment: state.paymentStatus });
        }
        const lock = new Date(state.lockAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" });
        const pendingNote = state.paymentStatus === "pending" ? ` রেফারেন্স ${state.paymentRef ?? "—"} যাচাইয়ের অপেক্ষায় — আবার পেমেন্ট করবেন না, শুধু যাচাই করুন।` : "";
        const msg: Record<number, [string, string]> = {
          9: ["নতুন CRM ইনভয়েস", `CRM রক্ষণাবেক্ষণ ইনভয়েস ${state.amountLabel}, শেষ তারিখ ১৪ তারিখ।`],
          10: ["CRM ইনভয়েস — মনে করিয়ে দেওয়া", `${state.amountLabel} ইনভয়েস এখনো যাচাই হয়নি। শেষ তারিখ ১৪ তারিখ।`],
          11: ["CRM ইনভয়েস — মনে করিয়ে দেওয়া", `${state.amountLabel} ইনভয়েস এখনো যাচাই হয়নি। শেষ তারিখ ১৪ তারিখ।`],
          12: ["CRM ইনভয়েস — শেষ তারিখ সামনে", `${state.amountLabel} ইনভয়েসের শেষ তারিখ ১৪ তারিখ।`],
          13: ["CRM ইনভয়েস — শেষ তারিখ আগামীকাল", `${state.amountLabel} ইনভয়েসের শেষ তারিখ আগামীকাল (১৪ তারিখ)।`],
          14: ["আজ শেষ তারিখ — রাত ১২টায় লক", `${state.amountLabel} আজ (১৪ তারিখ) পরিশোধযোগ্য; যাচাই না হলে রাত ২৩:৫৯-এর পর CRM লক হবে।`],
        };
        const [title, body] = msg[day]!;
        const sent = await m.notifyOnce(
          `maintenance_reminder_${state.period}_d${day}`,
          day <= 11 ? "info" : day === 12 ? "warning" : "critical",
          title,
          `${body}${pendingNote} লক সময়: ${lock} (ঢাকা)। পেমেন্ট অবস্থা: ${state.paymentStatus}। IT Console-এ পেমেন্ট রেফারেন্স দিন।`,
        );
        return Response.json({ ok: true, sent, day });
      },
    },
  },
});
