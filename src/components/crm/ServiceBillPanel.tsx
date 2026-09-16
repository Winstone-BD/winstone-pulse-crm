import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Download, Loader2, Receipt, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openInvoicePdf } from "@/lib/invoice-pdf";
import { getAdminToken } from "@/lib/local-session";
import {
  recordServicePayout,
  serviceBillingOverview,
  verifyServiceInvoice,
} from "@/lib/service-billing.functions";

/**
 * Monthly ৳4,000 service bill. `mode="hq"` is the read-only executive view;
 * `mode="it"` adds payment verification and the ৳1,000 architect payout entry.
 * No card, CVV, OTP or password is ever collected here — only a reference for
 * the money that already arrived.
 */

const STATUS_LABEL: Record<string, string> = {
  due: "বকেয়া",
  verifying: "যাচাই চলছে",
  paid: "পরিশোধিত",
  overdue: "মেয়াদোত্তীর্ণ",
  failed: "ব্যর্থ",
};

const STATUS_TONE: Record<string, string> = {
  due: "bg-muted text-muted-foreground",
  verifying: "bg-primary/15 text-primary",
  paid: "bg-primary/20 text-primary",
  overdue: "bg-destructive/15 text-destructive",
  failed: "bg-destructive/15 text-destructive",
};

const PAYOUT_LABEL: Record<string, string> = {
  pending: "অপেক্ষমাণ",
  processing: "চলছে",
  paid: "পরিশোধিত",
  failed: "ব্যর্থ",
};

function dhakaDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("bn-BD", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function taka(amount: number) {
  return `৳${amount.toLocaleString("bn-BD")}`;
}

export function ServiceBillPanel({ mode = "hq" }: { mode?: "hq" | "it" }) {
  const queryClient = useQueryClient();
  const load = useServerFn(serviceBillingOverview);
  const verify = useServerFn(verifyServiceInvoice);
  const payout = useServerFn(recordServicePayout);

  const [paymentRef, setPaymentRef] = useState("");
  const [method, setMethod] = useState("");
  const [payoutRef, setPayoutRef] = useState("");

  const query = useQuery({
    queryKey: ["service-billing"],
    queryFn: () => load({ data: { adminToken: getAdminToken() } }),
    refetchInterval: 60_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["service-billing"] });
  const current = query.data?.current ?? null;

  const verifyMutation = useMutation({
    mutationFn: () =>
      verify({
        data: {
          adminToken: getAdminToken(),
          period: current?.period ?? "",
          paymentRef,
          paymentMethod: method || null,
        },
      }),
    onSuccess: (result) => {
      toast.success(
        result.alreadyVerified
          ? "এই মাসের পেমেন্ট আগেই যাচাই হয়েছে — দ্বিতীয়বার কিছু হয়নি"
          : "পেমেন্ট যাচাই হয়েছে · বিল পরিশোধিত · সার্ভিস চালু",
      );
      setPaymentRef("");
      setMethod("");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const payoutMutation = useMutation({
    mutationFn: () =>
      payout({
        data: { adminToken: getAdminToken(), period: current?.period ?? "", payoutRef },
      }),
    onSuccess: (result) => {
      toast.success(
        result.alreadyPaid
          ? "পেআউট আগেই নথিভুক্ত — দ্বিগুণ হয়নি"
          : "৳১,০০০ আর্কিটেক্ট পেআউট নথিভুক্ত হয়েছে",
      );
      setPayoutRef("");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (query.isLoading) {
    return (
      <section className="card-elevated space-y-3 p-4">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded bg-muted" />
      </section>
    );
  }

  const architect = query.data?.architect;

  const downloadPdf = (invoice: NonNullable<typeof current>) => {
    const opened = openInvoicePdf(invoice, architect ?? null);
    if (!opened) toast.error("পপআপ ব্লক হয়েছে — অনুমতি দিয়ে আবার চেষ্টা করুন");
  };


  return (
    <section className="card-elevated space-y-4 p-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <Receipt className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">মাসিক সার্ভিস বিল</h2>
            <p className="truncate text-xs text-muted-foreground">
              {taka(query.data?.monthlyAmountBdt ?? 4000)}/মাস · প্রতি মাসের ১৫ তারিখে বিল
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              query.data?.serviceActive
                ? "bg-primary/20 text-primary"
                : "bg-destructive/15 text-destructive"
            }`}
          >
            {query.data?.serviceActive ? "সার্ভিস চালু" : "সার্ভিস চালু নয়"}
          </span>
          {current ? (
            <Button size="sm" variant="outline" onClick={() => downloadPdf(current)}>
              <Download className="size-4" /> PDF
            </Button>
          ) : null}
        </div>
      </div>

      {current ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="পিরিয়ড" value={current.period} />
          <Field label="পরিমাণ" value={taka(current.amountBdt)} />
          <Field
            label="স্ট্যাটাস"
            value={
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  STATUS_TONE[current.status] ?? "bg-muted text-muted-foreground"
                }`}
              >
                {STATUS_LABEL[current.status] ?? current.status}
              </span>
            }
          />
          <Field label="মেয়াদ" value={dhakaDate(current.dueAt)} />
          <Field label="গ্রেস শেষ" value={dhakaDate(current.graceUntil)} />
          <Field label="পরিশোধের সময়" value={dhakaDate(current.paidAt)} />
          <Field label="সার্ভিস অ্যাক্টিভ-আনটিল" value={dhakaDate(current.serviceActiveUntil)} />
          <Field
            label="ভাগ"
            value={`${taka(current.systemShareBdt)} সিস্টেম + ${taka(current.architectShareBdt)} আর্কিটেক্ট`}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">এখনো কোনো বিল তৈরি হয়নি।</p>
      )}

      {architect ? (
        <div className="rounded-lg border border-border/60 p-3 text-xs text-muted-foreground">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="size-4 text-primary" /> আর্কিটেক্ট পেআউট
          </p>
          <p className="mt-1">
            {architect.name} · {architect.bank} · {architect.branch} · {architect.currency} · অ্যাকাউন্ট
            শেষ ৪ সংখ্যা {architect.accountLast4 ?? "—"} · পেআউট{" "}
            {PAYOUT_LABEL[current?.payoutStatus ?? "pending"]}
          </p>
        </div>
      ) : null}

      {mode === "it" && current ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            <p className="text-sm font-semibold">পেমেন্ট যাচাই</p>
            <Input
              value={paymentRef}
              onChange={(event) => setPaymentRef(event.target.value)}
              placeholder="পেমেন্ট রেফারেন্স / ট্রানজেকশন আইডি"
            />
            <Input
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              placeholder="মাধ্যম (bKash, ব্যাংক ট্রান্সফার…)"
            />
            <Button
              onClick={() => verifyMutation.mutate()}
              disabled={paymentRef.trim().length < 3 || verifyMutation.isPending}
              className="w-full"
            >
              {verifyMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <BadgeCheck className="size-4" />
              )}
              যাচাই করে বিল পরিশোধিত করুন
            </Button>
            <p className="text-xs text-muted-foreground">
              একবার যাচাই হলে সার্ভিস চালু, ভাগ ও পেআউট একবারই হবে — দ্বিগুণ হবে না।
            </p>
          </div>
          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            <p className="text-sm font-semibold">৳১,০০০ আর্কিটেক্ট পেআউট</p>
            <Input
              value={payoutRef}
              onChange={(event) => setPayoutRef(event.target.value)}
              placeholder="পেআউট রেফারেন্স"
            />
            <Button
              variant="outline"
              onClick={() => payoutMutation.mutate()}
              disabled={payoutRef.trim().length < 3 || payoutMutation.isPending}
              className="w-full"
            >
              {payoutMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              পেআউট নথিভুক্ত করুন
            </Button>
            <p className="text-xs text-muted-foreground">
              কার্ড, CVV, OTP বা পাসওয়ার্ড কোথাও নেওয়া হয় না।
            </p>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-semibold">ইনভয়েস ইতিহাস</p>
        <ul className="space-y-2">
          {(query.data?.invoices ?? []).map((invoice) => (
            <li
              key={invoice.period}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
            >
              <span className="font-medium">{invoice.period}</span>
              <span className="text-muted-foreground">{taka(invoice.amountBdt)}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  STATUS_TONE[invoice.status] ?? "bg-muted text-muted-foreground"
                }`}
              >
                {STATUS_LABEL[invoice.status] ?? invoice.status}
              </span>
              <span className="text-xs text-muted-foreground">
                মেয়াদ {dhakaDate(invoice.dueAt)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
