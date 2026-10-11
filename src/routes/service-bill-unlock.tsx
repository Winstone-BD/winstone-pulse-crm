import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Braces, KeyRound, Loader2, Lock, LogIn, MailCheck, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import {
  getServiceBillReviewAccess,
  getUnlockedServiceBill,
  lockServiceBillDetails,
  sendServiceBillTestEmail,
  unlockServiceBillDetails,
} from "@/lib/service-bill-review.functions";
import { dhakaTime } from "@/lib/maintenance-rules";

export const Route = createFileRoute("/service-bill-unlock")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Secure Service Bill Review — Winstone Pulse" },
      { name: "description", content: "Restricted human review of the Winstone IT service bill." },
      { property: "og:title", content: "Secure Service Bill Review — Winstone Pulse" },
      {
        property: "og:description",
        content: "Authorized review-only access; no payment execution.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ServiceBillUnlockPage,
});

function ServiceBillUnlockPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setSignedIn(Boolean(session?.user));
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (signedIn === null)
    return (
      <ReviewShell>
        <Loader2 className="size-5 animate-spin" />
      </ReviewShell>
    );
  if (!signedIn)
    return (
      <ReviewShell>
        <SignIn />
      </ReviewShell>
    );
  return (
    <ReviewShell>
      <ReviewGate />
    </ReviewShell>
  );
}

function ReviewShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-7 flex items-start justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" /> Winstone secure review
            </div>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Service Bill Review</h1>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/service-bill-alert">Alert</Link>
          </Button>
        </header>
        {children}
      </div>
    </main>
  );
}

function SignIn() {
  const [busy, setBusy] = useState(false);
  return (
    <Card className="mx-auto max-w-lg rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogIn className="size-5" /> CRM sign-in required
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          শুধু authorized CRM admin এই bill details review করতে পারবেন।
        </p>
        <Button
          className="w-full"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void lovable.auth
              .signInWithOAuth("google", {
                redirect_uri: `${window.location.origin}/service-bill-unlock`,
              })
              .then((result) => {
                if (result.error) toast.error(result.error.message);
              })
              .finally(() => setBusy(false));
          }}
        >
          <LogIn className="size-4" /> {busy ? "Signing in…" : "Continue with Google"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ReviewGate() {
  const accessFn = useServerFn(getServiceBillReviewAccess);
  const access = useQuery({
    queryKey: ["service-bill-review-access"],
    queryFn: () => accessFn(),
    retry: false,
  });
  if (access.isLoading) return <Loader2 className="size-5 animate-spin" />;
  if (access.error) {
    return (
      <Alert variant="destructive">
        <Lock className="size-4" />
        <AlertTitle>Access denied</AlertTitle>
        <AlertDescription>{(access.error as Error).message}</AlertDescription>
      </Alert>
    );
  }
  return access.data?.unlocked ? <UnlockedBill /> : <PinGate />;
}

function PinGate() {
  const [pin, setPin] = useState("");
  const qc = useQueryClient();
  const unlockFn = useServerFn(unlockServiceBillDetails);
  const unlock = useMutation({
    mutationFn: () => unlockFn({ data: { pin } }),
    onSuccess: (result) => {
      setPin("");
      if (!result.ok) {
        toast.error(result.missing.length ? `Missing: ${result.missing.join(", ")}` : result.error);
        return;
      }
      void qc.invalidateQueries({ queryKey: ["service-bill-review-access"] });
    },
    onError: (error: Error) => {
      setPin("");
      toast.error(error.message);
    },
  });
  return (
    <Card className="mx-auto max-w-lg rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5" /> Secure human review
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            unlock.mutate();
          }}
        >
          <p className="text-sm text-muted-foreground">
            CRM admin role যাচাইয়ের পর server-side review PIN দিন। Credential সংরক্ষণ বা audit করা
            হয় না।
          </p>
          <Input
            aria-label="Service bill review PIN"
            type="password"
            autoComplete="off"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
          />
          <Button className="w-full" type="submit" disabled={!pin || unlock.isPending}>
            {unlock.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Lock className="size-4" />
            )}{" "}
            Unlock bill details
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function UnlockedBill() {
  const qc = useQueryClient();
  const detailsFn = useServerFn(getUnlockedServiceBill);
  const sendFn = useServerFn(sendServiceBillTestEmail);
  const lockFn = useServerFn(lockServiceBillDetails);
  const details = useQuery({
    queryKey: ["service-bill-review-details"],
    queryFn: () => detailsFn(),
    retry: false,
  });
  const send = useMutation({
    mutationFn: () => sendFn(),
    onSuccess: (result) =>
      toast[result.sent ? "success" : "error"](
        result.sent
          ? "Test alert sent through Hostinger."
          : `Missing: ${result.missing.join(", ")}`,
      ),
    onError: (error: Error) => toast.error(error.message),
  });
  const lock = useMutation({
    mutationFn: () => lockFn(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["service-bill-review-access"] });
    },
  });
  if (details.isLoading) return <Loader2 className="size-5 animate-spin" />;
  if (details.error || !details.data)
    return (
      <Alert variant="destructive">
        <AlertTitle>Details unavailable</AlertTitle>
        <AlertDescription>
          {(details.error as Error)?.message ?? "Review session expired"}
        </AlertDescription>
      </Alert>
    );
  const { bill, email } = details.data;
  return (
    <div className="space-y-5">
      <Alert className="border-success/40 bg-success/10">
        <ShieldCheck className="size-4" />
        <AlertTitle>Details unlocked for human review</AlertTitle>
        <AlertDescription>
          No payment, transfer, approval, or financial submission is available on this page.
        </AlertDescription>
      </Alert>
      <Card className="rounded-lg">
        <CardHeader className="flex-row items-center justify-between gap-4 border-b border-border">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">{bill.issuer}</p>
            <CardTitle className="mt-2">{bill.service_name}</CardTitle>
          </div>
          <Badge variant="outline">{bill.status}</Badge>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div>
            <p className="text-4xl font-bold">${bill.amount.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">USD</p>
          </div>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <ReviewField label="Bill ID" value={bill.bill_id} />
            <ReviewField label="Recipient" value={bill.recipient} />
            <ReviewField label="Created" value={dhakaTime(bill.created_at)} />
            <ReviewField label="Due" value={dhakaTime(bill.due_at)} />
            <ReviewField
              label="Review status"
              value={bill.review_status === "in_review" ? "In Review" : "Pending Review"}
            />
            <ReviewField label="Reviewed at" value={dhakaTime(bill.reviewed_at)} />
          </dl>
          <div className="border-t border-border pt-5">
            <div className="mb-3 flex items-center gap-2">
              <Braces className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">JSON payload preview</h2>
            </div>
            <pre className="max-h-96 overflow-auto rounded-lg bg-ink p-4 text-xs leading-5 text-ink-foreground">
              {JSON.stringify(bill, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
      {email.missing.length > 0 ? (
        <Alert>
          <MailCheck className="size-4" />
          <AlertTitle>Email configuration required</AlertTitle>
          <AlertDescription>{email.missing.join(", ")}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" disabled={lock.isPending} onClick={() => lock.mutate()}>
          Lock details
        </Button>
        <Button disabled={send.isPending || email.missing.length > 0} onClick={() => send.mutate()}>
          <MailCheck className="size-4" /> Send safe test alert
        </Button>
      </div>
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-t border-border pt-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-semibold">{value}</dd>
    </div>
  );
}
