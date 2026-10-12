import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PhoneCall } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logAnyNumberCall } from "@/lib/call-reports.functions";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

/**
 * "যেকোনো কল লগ করুন" — the web side of the universal report rule.
 *
 * A call that came in, a follow-up the agent made from their own handset, or a
 * number that is not in the CRM at all: entering the number creates the lead
 * when it is new and opens the same mandatory post-call report popup.
 */
export function AnyNumberCallDialog() {
  const t = useT();
  const adminToken = useAdminToken();
  const queryClient = useQueryClient();
  const run = useServerFn(logAnyNumberCall);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [direction, setDirection] = useState<"incoming" | "outgoing">("incoming");
  const [connected, setConnected] = useState(true);

  const mutation = useMutation({
    mutationFn: () =>
      run({
        data: {
          adminToken,
          phoneNumber: phone,
          name: name.trim() || null,
          direction,
          connected,
          durationSeconds: 0,
        },
      }),
    onSuccess: (result) => {
      setOpen(false);
      setPhone("");
      setName("");
      toast.success(
        t(result.createdLead
          ? { bn: "নতুন লিড তৈরি হয়েছে — এখন রিপোর্টটি পূরণ করুন", en: "New lead created — now fill in the report" }
          : { bn: "কল জমা হয়েছে — এখন রিপোর্টটি পূরণ করুন", en: "Call logged — now fill in the report" }),
      );
      void queryClient.invalidateQueries({ queryKey: ["pending-call-report"] });
      void queryClient.invalidateQueries({ queryKey: ["crm-snapshot"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 shrink-0 gap-1.5 whitespace-nowrap rounded-full px-0 text-xs font-semibold sm:w-auto sm:px-2.5"
          title={t({ bn: "যেকোনো নম্বরের কল লগ করুন — রিপোর্ট বাধ্যতামূলক", en: "Log a call to any number — report required" })}
        >
          <PhoneCall className="size-3.5" />
          <span className="hidden sm:inline">{t({ bn: "কল লগ", en: "Log call" })}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t({ bn: "যেকোনো কল লগ করুন", en: "Log any call" })}</DialogTitle>
          <DialogDescription>
            {t({ bn: "নম্বরটি CRM-এ না থাকলেও নতুন লিড তৈরি হবে এবং রিপোর্টের পপ-আপ আসবে।", en: "Even if the number is not in the CRM, a new lead will be created and the report popup will appear." })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="any-call-phone">{t({ bn: "মোবাইল নম্বর", en: "Mobile number" })}</Label>
            <Input
              id="any-call-phone"
              inputMode="tel"
              placeholder="01XXXXXXXXX"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="any-call-name">{t({ bn: "নাম (জানা থাকলে)", en: "Name (if known)" })}</Label>
            <Input
              id="any-call-name"
              placeholder={t({ bn: "ক্রেতার নাম", en: "Customer name" })}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: "incoming", label: { bn: "কল এসেছে", en: "Incoming" } },
                { value: "outgoing", label: { bn: "কল দিয়েছি", en: "Outgoing" } },
              ] as const
            ).map((item) => (
              <Button
                key={item.value}
                type="button"
                variant={direction === item.value ? "default" : "outline"}
                onClick={() => setDirection(item.value)}
              >
                {t(item.label)}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: true, label: { bn: "কথা হয়েছে", en: "Connected" } },
                { value: false, label: { bn: "ধরেনি", en: "No answer" } },
              ] as const
            ).map((item) => (
              <Button
                key={String(item.value)}
                type="button"
                variant={connected === item.value ? "default" : "outline"}
                onClick={() => setConnected(item.value)}
              >
                {t(item.label)}
              </Button>
            ))}
          </div>

          <Button
            type="button"
            className="w-full"
            disabled={mutation.isPending || phone.trim().length < 5}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {t({ bn: "রিপোর্ট খুলুন", en: "Open report" })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
