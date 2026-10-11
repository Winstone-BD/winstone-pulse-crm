import { FileText, Smartphone } from "lucide-react";

import { CallbackLogButton } from "@/components/crm/CallbackLogButton";
import { WebCallButton } from "@/components/crm/WebCallButton";
import { WhatsAppAction } from "@/components/crm/WhatsAppAction";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

/** Presentation only: all call and report actions retain their existing gates. */
export function LeadCallControls({ leadId, phone, name, onDetails }: {
  leadId: string;
  phone: string;
  name: string;
  onDetails: () => void;
}) {
  const t = useT();
  const tools = "mx-auto size-11 rounded-full border border-border bg-secondary text-secondary-foreground hover:bg-muted [&_svg]:size-5";
  return (
    <div className="space-y-3 border-t border-border/70 pt-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="min-w-0 space-y-1.5">
          <WhatsAppAction phone={phone} leadId={leadId} label="" className={tools}
            ariaLabel={`${name} — WhatsApp`} />
          <p className="text-xs text-muted-foreground">WhatsApp</p>
        </div>
        <div className="min-w-0 space-y-1.5">
          <CallbackLogButton leadId={leadId} label="" className={tools}
            ariaLabel={`${name} — ${t({ bn: "কলব্যাক রিপোর্ট", en: "Callback report" })}`} />
          <p className="text-xs text-muted-foreground">{t({ bn: "কলব্যাক", en: "Callback" })}</p>
        </div>
        <div className="min-w-0 space-y-1.5">
          <Button type="button" size="icon" variant="secondary" className={tools}
            onClick={onDetails} title={t({ bn: "লিড বিস্তারিত", en: "Lead details" })}
            aria-label={`${name} — ${t({ bn: "লিড বিস্তারিত", en: "Lead details" })}`}>
            <FileText />
          </Button>
          <p className="text-xs text-muted-foreground">{t({ bn: "বিস্তারিত", en: "Details" })}</p>
        </div>
      </div>
      <WebCallButton leadId={leadId} phone={phone} name={name}
        label={t({ bn: "কল করুন", en: "Call" })}
        ariaLabel={`${name} — ${t({ bn: "কল করুন", en: "Call" })}`}
        className="h-14 w-full rounded-full text-base [&_svg]:size-6" />
      <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <Smartphone className="size-3.5 shrink-0" />
        {t({ bn: "নিজের SIM", en: "Your SIM" })}
      </p>
    </div>
  );
}