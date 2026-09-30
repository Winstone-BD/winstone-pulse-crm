import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, History, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPinVault, revealPinValue, rotatePinValue } from "@/lib/pin-vault.functions";
import { useAdminToken } from "@/lib/local-session";

type Surface = "master" | "it_console" | "leadhub";

const SURFACE_LABEL: Record<string, string> = {
  master: "মাস্টার পিন",
  it_console: "আইটি কনসোল পিন",
  leadhub: "LeadHub Nexus পিন",
};

function when(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" });
}

/**
 * Secure PIN section: the value is stored encrypted on the server, revealed only
 * inside a full IT Console session, and every rotation keeps a history row.
 */
export function PinVaultPanel() {
  const token = useAdminToken();
  const queryClient = useQueryClient();
  const load = useServerFn(getPinVault);
  const reveal = useServerFn(revealPinValue);
  const rotate = useServerFn(rotatePinValue);

  const [shown, setShown] = useState<Record<string, string>>({});
  const [surface, setSurface] = useState<Surface>("master");
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");

  const vault = useQuery({
    queryKey: ["pin-vault"],
    queryFn: () => load({ data: { adminToken: token ?? "" } }),
    enabled: Boolean(token),
  });

  const revealMutation = useMutation({
    mutationFn: (target: Surface) => reveal({ data: { adminToken: token ?? "", surface: target } }),
    onSuccess: (result, target) => {
      if (!result.pin) {
        toast.error("এই পিন এখনো ভল্টে রাখা হয়নি");
        return;
      }
      setShown((prev) => ({ ...prev, [target]: result.pin as string }));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rotateMutation = useMutation({
    mutationFn: () =>
      rotate({
        data: {
          adminToken: token ?? "",
          surface,
          pin,
          reason: reason.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("পিন সংরক্ষিত হয়েছে — এখনই কাজ করবে");
      setPin("");
      setReason("");
      setShown({});
      void queryClient.invalidateQueries({ queryKey: ["pin-vault"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!token) return null;

  const entries = vault.data?.entries ?? [];
  const history = vault.data?.history ?? [];

  return (
    <section className="card-elevated space-y-5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4 text-primary" /> সুরক্ষিত পিন ভল্ট
        </h2>
        <p className="text-xs text-muted-foreground">
          মান সার্ভারে এনক্রিপ্ট করে রাখা — কোনো নথিতে লেখা হয় না
        </p>
      </div>

      {vault.isPending ? (
        <p className="text-sm text-muted-foreground">লোড হচ্ছে…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {entries.map((entry) => (
            <div key={entry.surface} className="rounded-xl border border-border bg-surface-2 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound className="size-3.5 text-primary" /> {entry.label}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{entry.used}</p>
              <p className="tabular mt-3 text-lg font-bold tracking-[0.2em]">
                {shown[entry.surface] ?? entry.hint ?? "সংরক্ষিত নয়"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                শেষ বদল: {when(entry.updatedAt)}
                {entry.updatedByLabel ? ` · ${entry.updatedByLabel}` : ""}
              </p>
              {entry.stored && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  disabled={revealMutation.isPending}
                  onClick={() => {
                    if (shown[entry.surface]) {
                      setShown((prev) => {
                        const next = { ...prev };
                        delete next[entry.surface];
                        return next;
                      });
                    } else {
                      revealMutation.mutate(entry.surface as Surface);
                    }
                  }}
                >
                  {shown[entry.surface] ? (
                    <>
                      <EyeOff className="size-3.5" /> লুকান
                    </>
                  ) : (
                    <>
                      <Eye className="size-3.5" /> মান দেখুন
                    </>
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border p-3">
        <h3 className="text-sm font-semibold">পিন সংরক্ষণ বা রোটেশন</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <select
            value={surface}
            onChange={(event) => setSurface(event.target.value as Surface)}
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
            aria-label="কোন পিন"
          >
            <option value="master">মাস্টার পিন</option>
            <option value="it_console">আইটি কনসোল পিন</option>
            <option value="leadhub">LeadHub Nexus পিন</option>
          </select>
          <Input
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="নতুন পিন (৪+ অক্ষর)"
            autoComplete="new-password"
          />
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="কারণ (যেমন: কর্মী বিদায়)"
          />
          <Button
            disabled={pin.length < 4 || rotateMutation.isPending}
            onClick={() => rotateMutation.mutate()}
          >
            {rotateMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            সংরক্ষণ
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          নতুন পিন সঙ্গে সঙ্গে কাজ করবে; আগের সার্ভার পিনও চালু থাকবে।
        </p>
      </div>

      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <History className="size-4 text-primary" /> রোটেশন ইতিহাস
        </h3>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">এখনো কোনো রোটেশন হয়নি।</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {history.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs"
              >
                <span className="font-semibold">{SURFACE_LABEL[row.surface] ?? row.surface}</span>
                <span className="tabular text-muted-foreground">{row.hint}</span>
                <span className="text-muted-foreground">{row.reason ?? "কারণ লেখা নেই"}</span>
                <span className="text-muted-foreground">{when(row.rotatedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
