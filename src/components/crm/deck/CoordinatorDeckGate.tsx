import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, LogOut } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { SnapshotSkeleton } from "@/components/crm/SnapshotSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { coordinatorDeckStatus, unlockCoordinatorDeck } from "@/lib/coordinator-deck.functions";
import { setCoordToken, useAdminToken, useDeckToken } from "@/lib/local-session";
import { useMyAccount } from "@/lib/session";

const REASONS: Record<string, string> = {
  pin: "PIN ঠিক নয়।",
  gmail: "এই পথে শুধু Gmail (Google) সাইন-ইন চলে।",
  signin: "আগে Gmail দিয়ে সাইন ইন করুন।",
  locked: "বারবার ভুল PIN — ১৫ মিনিট পর আবার চেষ্টা করুন।",
};

/**
 * Coordinator Deck entry: normal coordinator/IT access passes straight through.
 * Otherwise Gmail sign-in → Coordinator PIN → deck-only token (server-checked).
 */
export function CoordinatorDeckGate({ children, deck }: { children: ReactNode; deck: ReactNode }) {
  const { scope, isPending } = useMyAccount();
  const adminToken = useAdminToken();
  const deckToken = useDeckToken();
  const coordToken = adminToken ? null : deckToken;
  const statusFn = useServerFn(coordinatorDeckStatus);
  const unlockFn = useServerFn(unlockCoordinatorDeck);
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setEmail(session?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const status = useQuery({
    queryKey: ["coord-status", coordToken, email],
    queryFn: () => statusFn({ data: { adminToken: coordToken } }),
    enabled: Boolean(coordToken) && Boolean(email),
    retry: false,
  });

  useEffect(() => {
    if (status.data && status.data.deck !== "full") setCoordToken(null);
  }, [status.data]);

  if (isPending || email === undefined) return <SnapshotSkeleton />;
  if (scope === "authority" || scope === "coordinator") return <>{children}</>;
  if (coordToken && email) {
    if (status.isPending) return <SnapshotSkeleton />;
    if (status.data?.deck === "full") {
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
            <span>{status.data.label}</span>
            <Button size="sm" variant="ghost" onClick={() => setCoordToken(null)}>
              <LogOut className="size-4" /> Lock deck
            </Button>
          </div>
          {deck}
        </div>
      );
    }
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await unlockFn({ data: { pin } });
      if (res.ok) {
        setCoordToken(res.token);
        setPin("");
      } else setError(REASONS[res.reason] ?? "আনলক হয়নি।");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="card-elevated mx-auto max-w-md space-y-4 p-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/15 text-primary">
          <KeyRound className="size-6" />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Lead Distribution Console</p>
          <h1 className="text-xl font-bold">Coordinator Deck</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Gmail দিয়ে সাইন ইন করুন, তারপর Coordinator PIN দিন।
          </p>
        </div>
        {!email ? (
          <Button
            size="lg"
            className="w-full"
            onClick={() =>
              void lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/dispatch` })
            }
          >
            Gmail দিয়ে সাইন ইন
          </Button>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <p className="text-xs text-muted-foreground">সাইন ইন: {email}</p>
            <Input
              type="password"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Coordinator PIN"
              aria-label="Coordinator PIN"
              className="h-11"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={!pin || busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} আনলক
            </Button>
          </form>
        )}
      </section>
      {children}
    </div>
  );
}
