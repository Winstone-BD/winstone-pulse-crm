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
        // (12th) and each grace day (13th, 14th) while payment is not verified.
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
          9: ["নতুন CRM ইনভয়েস", "CRM সাবস্ক্রিপশন ইনভয়েস $18.16 USD (VAT সহ), শেষ তারিখ ১২ তারিখ।"],
          10: ["CRM ইনভয়েস — মনে করিয়ে দেওয়া", "$18.16 USD (VAT সহ) ইনভয়েস এখনো যাচাই হয়নি। শেষ তারিখ ১২ তারিখ।"],
          11: ["CRM ইনভয়েস — শেষ তারিখ আগামীকাল", "$18.16 USD (VAT সহ) ইনভয়েসের শেষ তারিখ আগামীকাল (১২ তারিখ)।"],
          12: ["আজ রক্ষণাবেক্ষণ রিন্যুয়াল দিন", "CRM ইনভয়েস $18.16 USD (VAT সহ) আজ (১২ তারিখ) রিন্যুয়াল। ১৪ তারিখ ২৩:৫৯ পর্যন্ত গ্রেস।"],
          13: ["রক্ষণাবেক্ষণ ফি — গ্রেস সময় চলছে", "$18.16 USD এখনো যাচাই হয়নি। গ্রেস শেষ হবে ১৪ তারিখ ২৩:৫৯ (ঢাকা)।"],
          14: ["আজ গ্রেসের শেষ দিন — রাত ১২টায় লক", "$18.16 USD যাচাই না হলে আজ রাত ২৩:৫৯-এর পর CRM লক হবে।"],
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
