import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteItOfficer, listItOnboarding, decideItOnboarding } from "@/lib/it-provisioning.functions";
import { getAdminToken } from "@/lib/local-session";
import { useLang } from "@/lib/i18n";

export function ItOfficerProvisioning() {
  const lang = useLang();
  const t = (bn: string, en: string) => lang === "bn" ? bn : en;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const run = useServerFn(inviteItOfficer);
  const list = useServerFn(listItOnboarding);
  const decide = useServerFn(decideItOnboarding);
  const qc = useQueryClient();
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["it-onboarding"] }); void qc.invalidateQueries({ queryKey: ["staff-accounts"] }); };
  const rows = useQuery({ queryKey: ["it-onboarding"], queryFn: () => list({ data: { token: getAdminToken() ?? "" } }), refetchInterval: 30000, retry: false });
  const mutation = useMutation({ mutationFn: () => run({ data: { token: getAdminToken() ?? "", name, email } }), onSuccess: refresh });
  const approval = useMutation({ mutationFn: (input: { id: string; action: "approve" | "assign_role" }) => decide({ data: { ...input, token: getAdminToken() ?? "", confirmed: true } }), onSuccess: refresh });
  return <section className="mt-4 space-y-3 border-t border-border pt-4">
    <h3 className="text-sm font-semibold">{t("আইটি অফিসার আমন্ত্রণ", "IT officer invitation")}</h3>
    <div className="grid gap-2 sm:grid-cols-2">
      <Input aria-label={t("অফিসারের নাম", "Officer name")} placeholder={t("অফিসারের নাম", "Officer name")} value={name} onChange={e => setName(e.target.value)} />
      <Input type="email" aria-label={t("অফিসারের ইমেইল", "Officer email")} placeholder={t("অফিসারের ইমেইল", "Officer email")} value={email} onChange={e => setEmail(e.target.value)} />
    </div>
    <Button variant="outline" disabled={mutation.isPending || !name || !email} onClick={() => { if (window.confirm(t(`${email}-এ আমন্ত্রণ পাঠাবেন?`, `Send invitation to ${email}?`))) mutation.mutate(); }}><UserPlus className="size-4" />{t("আমন্ত্রণ পাঠান", "Send invitation")}</Button>
    {mutation.error && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
    {mutation.data && <p role="status" className="text-sm text-muted-foreground">{mutation.data.message}</p>}
    {rows.error && <p role="alert" className="text-sm text-muted-foreground">{rows.error.message}</p>}
    {approval.error && <p role="alert" className="text-sm text-destructive">{approval.error.message}</p>}
    <ul className="space-y-3">{rows.data?.map(row => <li key={row.id} className="rounded-lg border border-border p-3 space-y-2"><p className="font-medium">{row.name}</p><p className="break-all text-xs text-muted-foreground">{row.email}</p><ol className="flex flex-wrap gap-3 text-xs"><li>{row.status === "inviting" ? "…" : "✓"} {t("আমন্ত্রণ", "Invited")}</li><li>{row.password_set_at ? "✓" : "—"} {t("পাসওয়ার্ড", "Password set")}</li><li>{row.approved_at ? "✓" : "—"} {t("অনুমোদন", "Approved")}</li><li>{row.role_assigned_at ? "✓" : "—"} {t("আইটি ভূমিকা", "IT role")}</li></ol>{row.status === "password_set" || row.status === "approved" ? <Button size="sm" variant="outline" disabled={approval.isPending} onClick={() => { const action = row.status === "password_set" ? "approve" : "assign_role"; if (window.confirm(action === "approve" ? t(`${row.name}-এর পরিচয় অনুমোদন করবেন?`, `Approve ${row.name}’s identity?`) : t(`${row.name}-কে IT admin প্রবেশাধিকার দেবেন?`, `Grant IT admin access to ${row.name}?`))) approval.mutate({ id: row.id, action }); }}>{row.status === "password_set" ? t("অনুমোদন করুন", "Approve account") : t("আইটি ভূমিকা দিন", "Assign IT role")}</Button> : null}</li>)}</ul>
  </section>;
}
