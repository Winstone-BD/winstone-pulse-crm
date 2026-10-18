import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, KeyRound, Loader2, UserCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { issuePasswordResetLink, updateStaffAccount } from "@/lib/accounts.functions";
import { type AgentActivityRow, listAgentActivity } from "@/lib/agent-activity.functions";
import { getAdminToken } from "@/lib/local-session";

export const agentActivityKey = ["agent-activity"] as const;

export function useAgentActivity() {
  const list = useServerFn(listAgentActivity);
  return useQuery({
    queryKey: agentActivityKey,
    queryFn: () => list({ data: { adminToken: getAdminToken() } }),
    refetchInterval: 30_000,
  });
}

export function dhaka(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function steps(r: AgentActivityRow) {
  const passwordSet = r.hasAccount && !r.mustChangePassword && Boolean(r.lastLoginAt);
  const loginConfirmed =
    passwordSet && (!r.linkIssuedAt || (r.lastLoginAt ?? "") > r.linkIssuedAt);
  return [
    { label: "অ্যাকাউন্ট তৈরি", done: r.hasAccount },
    { label: "লিংক পাঠানো", done: Boolean(r.linkIssuedAt) || passwordSet },
    { label: "পাসওয়ার্ড সেট", done: passwordSet },
    { label: "লগইন নিশ্চিত", done: loginConfirmed },
    { label: "সক্রিয়", done: r.isActive && r.approved },
  ];
}

/**
 * IT onboarding: account → one-time link → agent sets password → first login
 * confirmed from the auth record → IT marks active. Passwords are never shown.
 */
export function AgentOnboarding() {
  const qc = useQueryClient();
  const { data, isLoading } = useAgentActivity();
  const issue = useServerFn(issuePasswordResetLink);
  const update = useServerFn(updateStaffAccount);
  const [shown, setShown] = useState<{ id: string; link: string } | null>(null);

  const link = useMutation({
    mutationFn: (profileId: string) =>
      issue({ data: { adminToken: getAdminToken() ?? "", profileId, origin: window.location.origin } }),
    onSuccess: (res, profileId) => {
      setShown({ id: profileId, link: res.sentTo });
      toast.success(`${res.name}-এর নিজের ইমেইলে (${res.sentTo}) রিসেট লিংক পাঠানো হয়েছে`);
      void qc.invalidateQueries({ queryKey: agentActivityKey });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "লিংক তৈরি হয়নি"),
  });
  const activate = useMutation({
    mutationFn: (profileId: string) =>
      update({ data: { adminToken: getAdminToken(), profileId, isActive: true } }),
    onSuccess: () => {
      toast.success("সক্রিয় করা হয়েছে");
      void qc.invalidateQueries({ queryKey: agentActivityKey });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "সক্রিয় করা যায়নি"),
  });

  const rows = (data?.rows ?? []).filter((r) => r.role === "agent" || r.role === "team_leader");

  return (
    <div className="mt-6 rounded-lg border border-border p-4">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-primary" />
        <h3 className="flex-1 font-semibold">এজেন্ট অনবোর্ডিং</h3>
        <a href="/agent-activity" className="text-xs text-primary underline">
          অ্যাক্টিভিটি ও প্রিন্ট তালিকা →
        </a>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        ধাপ: অ্যাকাউন্ট (উপরের ফর্ম) → একবারের লিংক পাঠান → এজেন্ট নিজে পাসওয়ার্ড সেট করবে → প্রথম লগইন স্বয়ংক্রিয়ভাবে নিশ্চিত হবে → সক্রিয় করুন। পাসওয়ার্ড কেউ দেখে না।
      </p>
      {isLoading && <Loader2 className="mt-3 size-4 animate-spin" />}
      <ul className="mt-3 divide-y divide-border">
        {rows.map((r) => {
          const s = steps(r);
          return (
            <li key={r.profileId} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {r.name} <span className="tabular text-muted-foreground">· {r.employeeId ?? "—"}</span>
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!r.hasAccount || link.isPending}
                  onClick={() => link.mutate(r.profileId)}
                >
                  {link.isPending && link.variables === r.profileId ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="size-3.5" />
                  )}
                  লিংক তৈরি
                </Button>
                {!(r.isActive && r.approved) && (
                  <Button
                    size="sm"
                    disabled={!s[3]!.done || activate.isPending}
                    title={s[3]!.done ? "" : "আগে এজেন্টের লগইন নিশ্চিত হতে হবে"}
                    onClick={() => activate.mutate(r.profileId)}
                  >
                    <UserCheck className="size-3.5" /> সক্রিয় করুন
                  </Button>
                )}
              </div>
              <ol className="mt-2 flex flex-wrap gap-1.5">
                {s.map((step, i) => (
                  <li
                    key={step.label}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                      step.done
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {step.done ? <Check className="size-3" /> : <span className="tabular">{i + 1}</span>}
                    {step.label}
                  </li>
                ))}
              </ol>
              <p className="mt-1 text-[11px] text-muted-foreground">
                শেষ লগইন: {dhaka(r.lastLoginAt)} · লিংক: {dhaka(r.linkIssuedAt)}
                {r.mustChangePassword && " · নতুন পাসওয়ার্ড সেট বাকি"}
              </p>
              {shown?.id === r.profileId && (
                <p className="mt-2 rounded-md bg-muted p-2 text-xs">
                  রিসেট লিংক শুধু কর্মীর নিজের ইমেইলে গেছে: {shown.link}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
