import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { RoleGate } from "@/components/crm/RoleGate";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getAdminToken } from "@/lib/local-session";
import { listBookingReviews, reviewBooking } from "@/lib/bookings.functions";

export const Route = createFileRoute("/booking-review")({
  head: () => ({
    meta: [
      { title: "Booking Review — Winstone Pulse" },
      { name: "description", content: "HQ reviews agent booking requests and approves or rejects them before they reach Winstone OS." },
      { property: "og:title", content: "Booking Review — Winstone Pulse" },
      { property: "og:description", content: "Approve or reject booking requests before they are sent to Winstone OS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <RoleGate
        allow={["authority"]}
        surface="hq"
        icon={<ClipboardCheck className="size-7" />}
        title="বুকিং রিভিউ"
        description="শুধু HQ / IT — PIN দিয়ে খুলুন।"
      >
        <Queue />
      </RoleGate>
    </AppShell>
  );
}

const TABS = [
  { key: "pending", label: "অপেক্ষমাণ" },
  { key: "approved", label: "অনুমোদিত" },
  { key: "rejected", label: "বাতিল" },
] as const;

const RELAY_BN: Record<string, string> = {
  queued: "OS-এ পাঠানোর অপেক্ষায়",
  sending: "পাঠানো হচ্ছে",
  sent: "OS গ্রহণ করেছে",
  failed: "পাঠানো ব্যর্থ — আবার চেষ্টা হবে",
  dead: "পাঠানো যায়নি — IT দেখবে",
};

function Queue() {
  const list = useServerFn(listBookingReviews);
  const review = useServerFn(reviewBooking);
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const q = useQuery({
    queryKey: ["booking-reviews"],
    queryFn: () => list({ data: { adminToken: getAdminToken() } }),
    refetchInterval: 30_000,
  });
  const m = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "rejected" }) =>
      review({ data: { adminToken: getAdminToken(), id: v.id, decision: v.decision, note: notes[v.id] || null } }),
    onSuccess: (_r, v) => {
      toast.success(v.decision === "approved" ? "অনুমোদিত — Winstone OS-এ পাঠানো হচ্ছে" : "বুকিং বাতিল করা হয়েছে");
      void qc.invalidateQueries({ queryKey: ["booking-reviews"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (q.isLoading) return <div className="skeleton h-48 w-full" />;
  if (q.error)
    return <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{(q.error as Error).message}</div>;
  const rows = (q.data ?? []).filter((r) => r.approval === tab);

  return (
    <div className="grid gap-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">বুকিং রিভিউ</h1>
        <p className="text-xs text-muted-foreground">
          এজেন্টের বুকিং অনুরোধ এখানে আসে। অনুমোদন দিলে তবেই Winstone OS-এ যায়। সিদ্ধান্ত চূড়ান্ত, সব রেকর্ড থাকে। এখানে কোনো পেমেন্ট হয় না।
        </p>
      </header>
      <div className="flex gap-2">
        {TABS.map((t) => (
          <Button key={t.key} size="sm" variant={tab === t.key ? "default" : "outline"} onClick={() => setTab(t.key)}>
            {t.label} ({(q.data ?? []).filter((r) => r.approval === t.key).length})
          </Button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">এই তালিকায় কোনো বুকিং নেই।</p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => (
            <li key={r.id} className="card-elevated grid gap-2 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{r.leadName ?? "নামহীন লিড"}</p>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.bookedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} (ঢাকা)
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                এজেন্ট: {r.agentCode ? `${r.agentCode} · ` : ""}{r.agentName ?? "—"} · প্রজেক্ট: {r.project ?? "—"} · এলাকা: {r.area ?? "—"} ·
                পরিমাণ: {r.amountUsd != null ? `$${Number(r.amountUsd).toLocaleString("en-US")} USD` : "—"}
              </p>
              {r.notes ? <p className="text-sm">নোট: {r.notes}</p> : null}
              {r.approval === "pending" ? (
                <div className="grid gap-2">
                  <Textarea
                    aria-label="রিভিউ নোট"
                    placeholder="নোট (বাতিল করলে কারণ লিখতে হবে)"
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    className="min-h-16"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={m.isPending} onClick={() => m.mutate({ id: r.id, decision: "approved" })}>
                      {m.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} অনুমোদন
                    </Button>
                    <Button size="sm" variant="destructive" disabled={m.isPending} onClick={() => m.mutate({ id: r.id, decision: "rejected" })}>
                      <XCircle className="size-4" /> বাতিল
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {r.reviewedBy ?? "—"} · {r.reviewedAt ? new Date(r.reviewedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }) : ""}
                  {r.reviewNote ? ` · ${r.reviewNote}` : ""}
                </p>
              )}
              {r.approval === "approved" ? (
                <p
                  className={`w-fit rounded-md border px-2 py-1 text-xs font-medium ${
                    r.relayStatus === "sent"
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : r.relayStatus === "failed" || r.relayStatus === "dead"
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  Winstone OS: {RELAY_BN[r.relayStatus ?? ""] ?? "এখনো পাঠানো হয়নি"}
                  {r.relayStatus === "sent" && r.relayAt
                    ? ` · ${new Date(r.relayAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} (ঢাকা)`
                    : ""}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
