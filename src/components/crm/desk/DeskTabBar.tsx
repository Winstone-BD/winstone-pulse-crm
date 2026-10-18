import {
  CalendarClock,
  ChevronDown,
  MessagesSquare,
  Home,
  List,
  MessageCircle,
  PhoneCall,
  LayoutGrid,
  FileText,
  LifeBuoy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ITEMS = [
  {
    tab: "today",
    label: { bn: "আজ", en: "Today" },
    Icon: Home,
    tone: "text-chart-2 bg-chart-2/10",
  },
  {
    tab: "pipeline",
    label: { bn: "পাইপলাইন", en: "Pipeline" },
    Icon: LayoutGrid,
    tone: "text-primary bg-primary/10",
  },
  {
    tab: "leads",
    label: { bn: "লিড", en: "Contacts" },
    Icon: List,
    tone: "text-chart-2 bg-chart-2/10",
  },
  {
    tab: "tasks",
    label: { bn: "কাজ", en: "Tasks" },
    Icon: CalendarClock,
    tone: "text-chart-4 bg-chart-4/10",
  },
  {
    tab: "activities",
    label: { bn: "কার্যক্রম", en: "Activities" },
    Icon: PhoneCall,
    tone: "text-success bg-success/10",
  },
  {
    tab: "outlook",
    label: { bn: "আউটলুক", en: "Outlook" },
    Icon: FileText,
    tone: "text-chart-2 bg-chart-2/10",
  },
  {
    tab: "queue",
    label: { bn: "কার্ড ভিউ", en: "Queue" },
    Icon: LayoutGrid,
    tone: "text-primary bg-primary/10",
  },
  {
    tab: "calls",
    label: { bn: "কল", en: "Calls" },
    Icon: PhoneCall,
    tone: "text-success bg-success/10",
  },
  {
    tab: "whatsapp",
    label: { bn: "হোয়াটসঅ্যাপ", en: "WhatsApp" },
    Icon: MessageCircle,
    tone: "text-success bg-success/10",
  },
  {
    tab: "calendar",
    label: { bn: "ফলো-আপ", en: "Follow-ups" },
    Icon: CalendarClock,
    tone: "text-chart-4 bg-chart-4/10",
  },
  {
    tab: "reports",
    label: { bn: "রিপোর্ট", en: "Reports" },
    Icon: FileText,
    tone: "text-chart-2 bg-chart-2/10",
  },
  {
    tab: "social",
    label: { bn: "সোশ্যাল", en: "Social" },
    Icon: MessagesSquare,
    tone: "text-primary bg-primary/10",
  },
  {
    tab: "support",
    label: { bn: "সাপোর্ট", en: "Support" },
    Icon: LifeBuoy,
    tone: "text-destructive bg-destructive/10",
  },
] as const;

/** All sections visible in a two-column picker; no sideways navigation. */
export function DeskTabBar({ tab, onChange }: { tab: string; onChange: (t: string) => void }) {
  const t = useT();
  const primary = ITEMS.filter((i) => ["today", "calendar", "reports"].includes(i.tab));
  const advanced = ITEMS.filter((i) => !["today", "calendar", "reports"].includes(i.tab));
  const renderItem = ({ tab: value, label, Icon }: (typeof ITEMS)[number]) => (
    <Button
      key={value}
      variant={tab === value ? "default" : "ghost"}
      aria-current={tab === value ? "page" : undefined}
      onClick={() => onChange(value)}
      className="min-h-12 h-auto min-w-0 justify-start gap-2 whitespace-normal"
    >
      <Icon className="size-4 shrink-0" />
      <span>{t(label)}</span>
    </Button>
  );
  return (
    <div className="border-b border-border bg-background py-2">
      <nav
        aria-label={t({ bn: "আজকের কাজের বিভাগ", en: "Daily work sections" })}
        className="grid grid-cols-3 gap-1"
      >
        {primary.map(renderItem)}
      </nav>
      <details className="group mt-1">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm text-muted-foreground">
          {t({ bn: "আরও", en: "More" })}
          <ChevronDown className="size-4" />
        </summary>
        <nav
          aria-label={t({ bn: "অন্যান্য কাজ", en: "Other work" })}
          className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-4"
        >
          {advanced.map(renderItem)}
        </nav>
      </details>
    </div>
  );
}
