import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ChevronLeft, Eye, EyeOff, Loader2, Lock, LockOpen, LogIn, ScrollText, ShieldCheck, Users } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import logoAsset from "@/assets/winstone-logo.png.asset.json";
import brandPhoto from "@/assets/projects/06_-_Winstone_Lake_View_Height.jpg.asset.json";
import { Button } from "@/components/ui/button";
import { IT_OFFICER_EMAILS, ItOfficerPicker } from "@/components/crm/ItOfficerPicker";
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
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedOfficer, setSelectedOfficer] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const selectOfficer = (name: string) => {
    setSelectedOfficer(name);
    const verified = IT_OFFICER_EMAILS[name];
    if (verified) setEmail(verified);
    requestAnimationFrame(() => (verified ? passwordRef : emailRef).current?.focus());
  };
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
        if (!next) { setPin(""); setChallenge(null); setPassword(""); setEmail(""); setSelectedOfficer(null); }
        onOpenChange(next);
      }}
    >
      <DialogContent className={challenge && surface === "system" ? "max-h-[96dvh] w-[calc(100vw-1rem)] max-w-5xl gap-0 overflow-y-auto p-0 sm:max-w-5xl sm:p-0 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" : "max-h-[90dvh] overflow-y-auto sm:max-w-sm"}>
        {challenge && surface === "system" && (
          <aside className="relative hidden min-h-[560px] overflow-hidden rounded-l-lg md:block" aria-hidden="true">
            <img src={brandPhoto.url} alt="" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
            <div className="relative flex h-full flex-col justify-between p-8">
              <img src={logoAsset.url} alt="" className="h-14 w-auto self-start object-contain" />
              <div>
                <p className="font-display text-5xl text-foreground">IT <span className="text-gold">Console</span></p>
                <p className="mt-2 text-lg font-medium text-foreground">Secure access. Intelligent operations.</p>
                <ul className="mt-8 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                  <li className="flex items-center gap-1.5"><ShieldCheck className="size-4 shrink-0 text-gold" />Two-step access</li>
                  <li className="flex items-center gap-1.5"><Users className="size-4 shrink-0 text-gold" />Role-based</li>
                  <li className="flex items-center gap-1.5"><ScrollText className="size-4 shrink-0 text-gold" />Fully audited</li>
                </ul>
              </div>
            </div>
          </aside>
        )}
        <div className={challenge && surface === "system" ? "grid gap-5 p-5 sm:p-8" : "contents"}>
        <DialogHeader className={challenge && surface === "system" ? "m-0 items-start rounded-none border-0 bg-transparent p-0 text-left shadow-none backdrop-blur-none" : "items-center text-center"}>
          {challenge && surface === "system" ? (
            <>
              <div className="flex w-full min-w-0 items-center gap-3">
                <img src={logoAsset.url} alt="" className="h-9 w-auto shrink-0 object-contain md:hidden" />
                <span className="shrink-0 whitespace-nowrap rounded-md bg-gold/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-gold">IT Console</span>
                <span className="hidden min-w-0 items-center gap-1 truncate text-xs uppercase sm:inline-flex tracking-wider text-muted-foreground"><Lock className="size-3.5 shrink-0" />Secure administrative access</span>
              </div>
              <DialogTitle className="mt-3 text-xl">Select your profile to continue</DialogTitle>
            </>
          ) : (
            <>
              <span className="grid size-11 place-items-center rounded-full bg-primary/15 text-primary">
                <Lock className="size-5" />
              </span>
              <DialogTitle>{surface === "system" ? "IT Console PIN" : surface === "leadhub" ? "LeadHub Nexus PIN" : "Control board PIN"}</DialogTitle>
            </>
          )}
          <DialogDescription className={challenge && surface === "system" ? "text-sm" : undefined}>
            {surface === "system" ? challenge ? "PIN verified. Sign in with your own authorized IT account — choosing a profile never grants access." : "Enter the IT PIN, then sign in to your own account." : surface === "leadhub" ? "LeadHub-এর আলাদা PIN দিন।" : "Enter the master PIN to unlock this board on this device."}
          </DialogDescription>
        </DialogHeader>
        {challenge && surface === "system" ? (
          <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); if (!accountLogin.isPending) accountLogin.mutate(); }}>
            <ItOfficerPicker selected={selectedOfficer} onSelect={selectOfficer} />
            {selectedOfficer && (
              <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm">
                <span className="inline-flex min-w-0 items-center gap-2 truncate"><CheckCircle2 className="size-4 shrink-0 text-gold" /><span className="hidden sm:inline">Selected:</span> <strong className="truncate">{selectedOfficer}</strong></span>
                <button type="button" className="shrink-0 text-xs font-medium text-gold underline-offset-2 hover:underline" onClick={() => { setSelectedOfficer(null); setEmail(""); requestAnimationFrame(() => emailRef.current?.focus()); }}>Use a different account</button>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="it-login-email">Username or Email</Label>
              <Input ref={emailRef} id="it-login-email" type="email" autoComplete="username" required maxLength={160} placeholder="you@winstonebd.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={accountLogin.isPending} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="it-login-password">Password</Label>
              <div className="relative">
                <Input ref={passwordRef} id="it-login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required maxLength={200} className="pr-10" value={password} onChange={(event) => setPassword(event.target.value)} disabled={accountLogin.isPending} aria-invalid={accountLogin.isError || undefined} aria-describedby={accountLogin.isError ? "it-login-error" : undefined} />
                <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((v) => !v)} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {accountLogin.isError && <p id="it-login-error" role="alert" className="text-xs text-destructive">{accountLogin.error.message}</p>}
            </div>
            <Button type="submit" size="lg" disabled={!email.includes("@") || !password || accountLogin.isPending}>
              {accountLogin.isPending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />} Sign in to IT Console
            </Button>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={accountLogin.isPending} onClick={() => { setChallenge(null); setPassword(""); setShowPassword(false); }}><ChevronLeft className="size-4" />Back to Master PIN</Button>
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-3.5 text-gold" />Access is monitored and audited.</p>
            </div>
          </form>
        ) : <div className="flex flex-col items-center gap-4 py-2">
          <Input
            key={attemptNo}
            type="password"
            inputMode="text"
            autoComplete="off"
            autoFocus
            placeholder={surface === "system" ? "IT PIN" : surface === "leadhub" ? "LeadHub PIN" : "Master PIN"}
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
        </div>
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
