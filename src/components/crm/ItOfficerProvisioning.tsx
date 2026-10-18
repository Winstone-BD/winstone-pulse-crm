import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteItOfficer } from "@/lib/it-provisioning.functions";
import { getAdminToken } from "@/lib/local-session";
import { useLang } from "@/lib/i18n";

export function ItOfficerProvisioning() {
  const lang = useLang();
  const t = (bn: string, en: string) => lang === "bn" ? bn : en;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const run = useServerFn(inviteItOfficer);
  const mutation = useMutation({ mutationFn: () => run({ data: { token: getAdminToken() ?? "", name, email } }) });
  return <section className="mt-4 space-y-3 border-t border-border pt-4">
    <h3 className="text-sm font-semibold">{t("আইটি অফিসার আমন্ত্রণ", "IT officer invitation")}</h3>
    <div className="grid gap-2 sm:grid-cols-2">
      <Input aria-label={t("অফিসারের নাম", "Officer name")} placeholder={t("অফিসারের নাম", "Officer name")} value={name} onChange={e => setName(e.target.value)} />
      <Input type="email" aria-label={t("অফিসারের ইমেইল", "Officer email")} placeholder={t("অফিসারের ইমেইল", "Officer email")} value={email} onChange={e => setEmail(e.target.value)} />
    </div>
    <Button variant="outline" disabled={mutation.isPending || !name || !email} onClick={() => mutation.mutate()}><UserPlus className="size-4" />{t("আমন্ত্রণ পাঠান", "Send invitation")}</Button>
    {mutation.error && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
    {mutation.data && <p role="status" className="text-sm text-muted-foreground">{mutation.data.message}</p>}
  </section>;
}
