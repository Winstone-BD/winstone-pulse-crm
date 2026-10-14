import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, FileCheck2, LockKeyhole, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServiceBillAlert } from "@/lib/service-bill-review.functions";
import { dhakaTime } from "@/lib/maintenance-rules";

export const billQuery = queryOptions({
  queryKey: ["service-bill-alert"],
  queryFn: () => getServiceBillAlert(),
});

export const Route = createFileRoute("/service-bill-alert")({
  // Admin-only data: load in the browser so the signed-in session is attached.
  ssr: false,
  loader: ({ context }) => context.queryClient.ensureQueryData(billQuery),
  head: () => ({
    meta: [
      { title: "Service Bill Alert — Winstone Pulse" },
      {
        name: "description",
        content: "Winstone Pulse IT service bill awaiting authorized human review.",
      },
      { property: "og:title", content: "Service Bill Alert — Winstone Pulse" },
      { property: "og:description", content: "Review-only Winstone IT service bill notice." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ServiceBillAlertPage,
});

function ServiceBillAlertPage() {
  const { data: bill } = useSuspenseQuery(billQuery);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
        <header className="flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" /> Winstone IT Team
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">Service Bill Alert</h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              এটি একটি review notification—কোনো payment, transfer বা automatic approval নয়।
            </p>
          </div>
          <Badge
            variant="outline"
            className="w-fit border-warning/50 bg-warning/10 text-warning-foreground"
          >
            Pending Review
          </Badge>
        </header>

        <section className="grid gap-5 py-7 md:grid-cols-[1.35fr_0.65fr]">
          <Card className="overflow-hidden rounded-lg">
            <CardHeader className="border-b border-border bg-ink text-ink-foreground">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-ink-muted">
                    Monthly service bill
                  </p>
                  <CardTitle className="mt-2 text-xl">{bill.service_name}</CardTitle>
                </div>
                <FileCheck2 className="size-7 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Amount due</p>
                <p className="mt-1 text-4xl font-bold">${bill.amount.toFixed(2)}</p>
                <p className="text-sm font-medium text-muted-foreground">{bill.currency}</p>
              </div>
              <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                <BillField label="Bill ID" value={bill.bill_id} mono />
                <BillField label="Status" value={bill.status} />
                <BillField label="Issuer" value={bill.issuer} />
                <BillField
                  label="Review status"
                  value={bill.review_status === "in_review" ? "In Review" : "Pending Review"}
                />
                <BillField label="Created" value={dhakaTime(bill.created_at)} />
                <BillField label="Due" value={dhakaTime(bill.due_at)} />
              </dl>
            </CardContent>
          </Card>

          <aside className="space-y-4">
            <Alert className="border-primary/30 bg-primary/5">
              <LockKeyhole className="size-4" />
              <AlertTitle>Human review required</AlertTitle>
              <AlertDescription>
                বিস্তারিত দেখতে authorized CRM admin-কে sign in এবং secure PIN verification করতে
                হবে।
              </AlertDescription>
            </Alert>
            <div className="rounded-lg border border-border bg-surface p-5">
              <CalendarClock className="size-5 text-primary" />
              <p className="mt-3 text-sm font-semibold">Review-only workflow</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Review access কোনো payment status বদলায় না এবং কোনো financial instruction submit
                করে না।
              </p>
              <Button asChild className="mt-5 w-full">
                <Link to="/service-bill-unlock">Authorized review</Link>
              </Button>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function BillField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 border-t border-border pt-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 break-words font-semibold ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
