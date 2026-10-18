import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock, LockOpen } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
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
import { unlockAdmin } from "@/lib/crm.functions";
import { setAdminToken, setLeadHubToken, useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

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
  const [remaining, setRemaining] = useState(0);
  const t = useT();
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);
  const unlock = useServerFn(unlockAdmin);

  const attempt = useMutation({
    mutationFn: (value: string) => unlock({ data: { pin: value, surface } }),
    onSuccess: (result) => {
      if (result.ok) {
        setRemaining(0);
        if (surface === "leadhub") setLeadHubToken(result.token);
        else setAdminToken(result.token);
        toast.success(
          surface === "hq" ? "Executive HQ unlocked (view-only)" : surface === "leadhub" ? "LeadHub Nexus unlocked" : "Control board unlocked",
        );
        setPin("");
        onOpenChange(false);
        onUnlocked?.();
      } else {
        setRemaining(result.retryAfterSeconds);
        toast.error(result.retryAfterSeconds > 0 ? t({ bn: "PIN প্রবেশে সাময়িক বিরতি", en: "PIN entry temporarily paused" }) : t({ bn: "ভুল PIN", en: "Wrong PIN" }));
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
        if (!next) setPin("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <span className="grid size-11 place-items-center rounded-full bg-primary/15 text-primary">
            <Lock className="size-5" />
          </span>
          <DialogTitle>{surface === "leadhub" ? "LeadHub Nexus PIN" : "Control board PIN"}</DialogTitle>
          <DialogDescription>
            {surface === "leadhub" ? "LeadHub-এর আলাদা PIN দিন।" : "Enter the master PIN to unlock this board on this device."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <Input
            key={attemptNo}
            type="password"
            inputMode="text"
            autoComplete="off"
            aria-label={surface === "leadhub" ? "LeadHub PIN" : "Master PIN"}
            autoFocus
            placeholder={surface === "leadhub" ? "LeadHub PIN" : "Master PIN"}
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && pin.length >= 4 && !attempt.isPending && remaining === 0) {
                attempt.mutate(pin);
              }
            }}
            disabled={attempt.isPending || remaining > 0}
            className="text-center tracking-[0.3em]"
          />
          <Button
            className="w-full"
            aria-busy={attempt.isPending}
            disabled={pin.length < 4 || attempt.isPending || remaining > 0}
            onClick={() => attempt.mutate(pin)}
          >
            {attempt.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LockOpen className="size-4" />
            )}
            Unlock
          </Button>
          {remaining > 0 && <p role="alert" className="text-center text-sm text-destructive">{t({ bn: "PIN প্রবেশে সাময়িক বিরতি। বাকি", en: "PIN entry temporarily paused. Remaining" })}: {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</p>}
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
