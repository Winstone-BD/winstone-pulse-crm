import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { clearMustChangePassword } from "@/lib/accounts.functions";
import { setInvitedItPassword } from "@/lib/it-provisioning.functions";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "নতুন পাসওয়ার্ড সেট করুন — Winstone Pulse" },
      { name: "description", content: "Winstone Pulse এজেন্টদের জন্য নিরাপদ নতুন পাসওয়ার্ড সেট করার পেজ।" },
      { property: "og:title", content: "নতুন পাসওয়ার্ড সেট করুন — Winstone Pulse" },
      { property: "og:description", content: "একবার ব্যবহারযোগ্য লিংক দিয়ে নিজের নতুন পাসওয়ার্ড সেট করুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const clear = useServerFn(clearMustChangePassword);
  const setItPassword = useServerFn(setInvitedItPassword);
  const [ready, setReady] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    return () => sub.subscription.unsubscribe();
  }, []);

  const save = async (): Promise<void> => {
    if (pw.length < 8) { toast.error("কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড দিন"); return; }
    if (pw !== pw2) { toast.error("দুটি পাসওয়ার্ড মেলেনি"); return; }
    setBusy(true);
    try {
    const itSetup = await setItPassword({ data: { password: pw } });
    if (itSetup.handled) {
      setPw(""); setPw2("");
      toast.success("পাসওয়ার্ড সেট হয়েছে; Architect অনুমোদন ও IT ভূমিকা দেওয়ার অপেক্ষায়");
      void navigate({ to: "/" });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setBusy(false);
      { toast.error(error.message); return; }
    }
    await clear();
    await supabase.auth.refreshSession();
    toast.success("নতুন পাসওয়ার্ড সেট হয়েছে");
    void navigate({ to: "/" });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Password setup failed"); }
    finally { setBusy(false); }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <KeyRound className="size-5 text-primary" />
          <h1 className="text-lg font-semibold">নতুন পাসওয়ার্ড সেট করুন</h1>
        </div>
        {ready === false ? (
          <p className="text-sm text-muted-foreground">
            লিংকটি আর বৈধ নেই বা আগেই ব্যবহার হয়েছে। IT-এর কাছে নতুন লিংক চান।
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              ডেস্ক ব্যবহারের আগে নিজের নতুন পাসওয়ার্ড দিন। এটি কেউ দেখতে পাবে না।
            </p>
            <Input type="password" placeholder="নতুন পাসওয়ার্ড" value={pw} onChange={(e) => setPw(e.target.value)} />
            <Input type="password" placeholder="আবার লিখুন" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            <Button className="w-full" disabled={busy || !ready} onClick={() => void save()}>
              {busy && <Loader2 className="size-4 animate-spin" />} সেভ করুন
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
