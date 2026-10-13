import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock, LockOpen } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { signInWithIdentifier } from "@/lib/accounts.functions";
import { completeItAccess } from "@/lib/it-access.functions";
import { unlockAdmin } from "@/lib/crm.functions";
import { setAdminToken, setLeadHubToken, useAdminToken } from "@/lib/local-session";

/** Controlled PIN modal. Once unlocked the token is kept in localStorage. */
export function AdminPinDialog({
  open,
  onOpenChange,
  onUnlocked,
  surface = "system",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked?: () => void;
  /** HQ is view-only; system and LeadHub mint isolated full-access sessions. */
  surface?: "hq" | "system" | "leadhub";
}) {
  const [pin, setPin] = useState("");
  const [attemptNo, setAttemptNo] = useState(0);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const queryClient = useQueryClient();
  const unlock = useServerFn(unlockAdmin);
  const complete = useServerFn(completeItAccess);
  const accountLogin = useMutation({
    mutationFn: async () => {
      if (!challenge) throw new Error("Enter the IT PIN first");
      const tokens = await signInWithIdentifier({ data: { identifier: email.trim(), password } });
      const { error } = await supabase.auth.setSession(tokens);
      if (error) throw error;
      try { return await complete({ data: { challenge } }); }
      catch (error) { await supabase.auth.signOut(); throw error; }
    },
    onSuccess: async (result) => {
      setAdminToken(result.token);
      setPassword(""); setChallenge(null);
      await queryClient.invalidateQueries({ queryKey: ["my-account"] });
      toast.success("IT Console account signed in");
      onOpenChange(false); onUnlocked?.();
    },
    onError: (error: Error) => { setPassword(""); toast.error(error.message); },
  });

  const attempt = useMutation({
    mutationFn: (value: string) => unlock({ data: { pin: value, surface } }),
    onSuccess: (result) => {
      if (result.ok) {
        if (surface === "system") { setChallenge(result.token); setPin(""); return; }
        if (surface === "leadhub") setLeadHubToken(result.token);
        else setAdminToken(result.token);
        toast.success(
          surface === "hq" ? "Executive HQ unlocked (view-only)" : surface === "leadhub" ? "LeadHub Nexus unlocked" : "Control board unlocked",
        );
        setPin("");
        onOpenChange(false);
        onUnlocked?.();
      } else {
        toast.error("Wrong PIN");
        setPin("");
        setAttemptNo((n) => n + 1);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setPin("");
      setAttemptNo((n) => n + 1);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) { setPin(""); setChallenge(null); setPassword(""); }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <span className="grid size-11 place-items-center rounded-full bg-primary/15 text-primary">
            <Lock className="size-5" />
          </span>
          <DialogTitle>{surface === "system" ? challenge ? "IT Console sign in" : "IT Console PIN" : surface === "leadhub" ? "LeadHub Nexus PIN" : "Control board PIN"}</DialogTitle>
          <DialogDescription>
            {surface === "system" ? challenge ? "Sign in with your authorized IT officer account." : "Enter the IT PIN, then sign in to your own account." : surface === "leadhub" ? "LeadHub-এর আলাদা PIN দিন।" : "Enter the master PIN to unlock this board on this device."}
          </DialogDescription>
        </DialogHeader>
        {challenge && surface === "system" ? (
          <form className="grid gap-4 py-2" onSubmit={(event) => { event.preventDefault(); if (!accountLogin.isPending) accountLogin.mutate(); }}>
            <div className="grid gap-1.5">
              <Label htmlFor="it-login-email">Email</Label>
              <Input id="it-login-email" type="email" autoComplete="username" required maxLength={160} value={email} onChange={(event) => setEmail(event.target.value)} disabled={accountLogin.isPending} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="it-login-password">Password</Label>
              <Input id="it-login-password" type="password" autoComplete="current-password" required maxLength={200} value={password} onChange={(event) => setPassword(event.target.value)} disabled={accountLogin.isPending} />
            </div>
            <Button type="submit" disabled={!email.includes("@") || !password || accountLogin.isPending}>
              {accountLogin.isPending ? <Loader2 className="size-4 animate-spin" /> : <LockOpen className="size-4" />} Sign in to IT Console
            </Button>
            <Button type="button" variant="ghost" disabled={accountLogin.isPending} onClick={() => { setChallenge(null); setPassword(""); }}>Back to PIN</Button>
          </form>
        ) : <div className="flex flex-col items-center gap-4 py-2">
          <Input
            key={attemptNo}
            type="password"
            inputMode="text"
            autoComplete="off"
            autoFocus
            placeholder={surface === "leadhub" ? "LeadHub PIN" : "Master PIN"}
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && pin.length >= 4 && !attempt.isPending) {
                attempt.mutate(pin);
              }
            }}
            disabled={attempt.isPending}
            className="text-center tracking-[0.3em]"
          />
          <Button
            className="w-full"
            disabled={pin.length < 4 || attempt.isPending}
            onClick={() => attempt.mutate(pin)}
          >
            {attempt.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LockOpen className="size-4" />
            )}
            Unlock
          </Button>
        </div>}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Wraps an admin-only action. Unlocked: renders children as-is.
 * Locked: clicking the wrapper opens the PIN modal instead.
 */
export function AdminGate({
  children,
  locked,
  surface = "system",
}: {
  children: ReactNode;
  locked: (openPin: () => void) => ReactNode;
  surface?: "hq" | "system" | "leadhub";
}) {
  const token = useAdminToken();
  const [open, setOpen] = useState(false);

  if (token) return <>{children}</>;
  return (
    <>
      {locked(() => setOpen(true))}
      <AdminPinDialog open={open} onOpenChange={setOpen} surface={surface} />
    </>
  );
}
