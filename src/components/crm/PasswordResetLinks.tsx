import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { issuePasswordResetLink } from "@/lib/accounts.functions";
import { getAdminToken } from "@/lib/local-session";

type Row = { id: string; name: string; employee_id: string | null; user_id: string | null };

/** IT issues a single-use reset link per agent. Shown once; never saved. */
export function PasswordResetLinks({ staff }: { staff: Row[] }) {
  const issue = useServerFn(issuePasswordResetLink);
  const [shown, setShown] = useState<{ id: string; link: string } | null>(null);
  const run = useMutation({
    mutationFn: (profileId: string) =>
      issue({ data: { adminToken: getAdminToken() ?? "", profileId, origin: window.location.origin } }),
    onSuccess: (res, profileId) => {
      setShown({ id: profileId, link: res.link });
      toast.success(`${res.name}-এর জন্য একবার ব্যবহারযোগ্য লিংক তৈরি হয়েছে`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "লিংক তৈরি হয়নি"),
  });

  return (
    <div className="mt-6 rounded-lg border border-border p-4">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-primary" />
        <h3 className="font-semibold">পাসওয়ার্ড রিসেট লিংক (একবার ব্যবহারযোগ্য)</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        লিংকটি শুধু একবার কাজ করে ও কিছু সময় পর নিজে বাতিল হয়। এজেন্টকে সরাসরি WhatsApp/SMS-এ পাঠান। লিংক খুললে এজেন্ট নিজের নতুন পাসওয়ার্ড সেট করবে — পাসওয়ার্ড কেউ দেখতে পায় না, কার্ড বা PDF-এ থাকে না।
      </p>
      <ul className="mt-3 divide-y divide-border">
        {staff.filter((s) => s.user_id).map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="min-w-0 flex-1 truncate text-sm">
              {row.name} <span className="tabular text-muted-foreground">· {row.employee_id ?? "—"}</span>
            </span>
            <Button size="sm" variant="secondary" disabled={run.isPending} onClick={() => run.mutate(row.id)}>
              {run.isPending && run.variables === row.id ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
              লিংক তৈরি
            </Button>
            {shown?.id === row.id && (
              <div className="flex w-full items-center gap-2 rounded-md bg-muted p-2">
                <code className="min-w-0 flex-1 truncate text-xs">{shown.link}</code>
                <Button
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(shown.link);
                    toast.success("কপি হয়েছে — এখনই পাঠান");
                    setShown(null);
                  }}
                >
                  <Copy className="size-3.5" /> কপি
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
