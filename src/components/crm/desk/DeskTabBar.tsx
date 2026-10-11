import { CalendarClock, ChevronDown, Home, List, MessageCircle, PhoneCall, LayoutGrid, FileText, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ITEMS = [
  { tab: "today", label: { bn: "আজ", en: "Today" }, Icon: Home, tone: "text-chart-2 bg-chart-2/10" },
  { tab: "leads", label: { bn: "লিড", en: "Leads" }, Icon: List, tone: "text-chart-2 bg-chart-2/10" },
  { tab: "queue", label: { bn: "কার্ড ভিউ", en: "Queue" }, Icon: LayoutGrid, tone: "text-primary bg-primary/10" },
  { tab: "calls", label: { bn: "কল", en: "Calls" }, Icon: PhoneCall, tone: "text-success bg-success/10" },
  { tab: "whatsapp", label: { bn: "হোয়াটসঅ্যাপ", en: "WhatsApp" }, Icon: MessageCircle, tone: "text-success bg-success/10" },
  { tab: "calendar", label: { bn: "ফলো-আপ", en: "Follow-ups" }, Icon: CalendarClock, tone: "text-chart-4 bg-chart-4/10" },
  { tab: "reports", label: { bn: "রিপোর্ট", en: "Reports" }, Icon: FileText, tone: "text-chart-2 bg-chart-2/10" },
  { tab: "support", label: { bn: "সাপোর্ট", en: "Support" }, Icon: LifeBuoy, tone: "text-destructive bg-destructive/10" },
] as const;

/** All sections visible in a two-column picker; no sideways navigation. */
export function DeskTabBar({ tab, onChange }: { tab: string; onChange: (t: string) => void }) {
  const t = useT();
  return <details className="group border-y border-border bg-background">
    <summary className="grid min-h-14 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 [&::-webkit-details-marker]:hidden">
      <span className="min-w-0 text-sm font-semibold">{t({ bn: "আমার ডেস্ক", en: "My desk" })}<span className="ml-2 text-muted-foreground">/ {t(ITEMS.find((item) => item.tab === tab)?.label ?? ITEMS[0].label)}</span></span>
      <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
    </summary>
    <nav aria-label={t({ bn: "ডেস্ক সেকশন", en: "Desk sections" })} className="grid grid-cols-2 gap-2 border-t border-border p-3 sm:grid-cols-4">
      {ITEMS.map(({ tab: value, label, Icon, tone }) => <Button key={value} variant="ghost" aria-current={tab === value ? "page" : undefined}
        onClick={(event) => { onChange(value); event.currentTarget.closest("details")?.removeAttribute("open"); }}
        className={cn("h-auto min-h-14 min-w-0 justify-start gap-2 rounded-lg border px-2 text-left text-sm", tab === value ? "border-ring bg-accent font-bold" : "border-transparent")}>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", tone)}><Icon className="size-4" /></span>
        <span className="min-w-0 whitespace-normal break-words">{t(label)}</span>
      </Button>)}
    </nav>
  </details>;
}