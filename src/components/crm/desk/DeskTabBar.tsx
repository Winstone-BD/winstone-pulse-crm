import { CalendarClock, Home, List, MoreHorizontal, PhoneCall } from "lucide-react";

const ITEMS = [
  { tab: "today", label: "আজ", Icon: Home },
  { tab: "leads", label: "লিড", Icon: List },
  { tab: "calls", label: "কল", Icon: PhoneCall },
  { tab: "calendar", label: "ফলো-আপ", Icon: CalendarClock },
  { tab: "reports", label: "আরও", Icon: MoreHorizontal },
] as const;

/** Phone-only bottom navigation for the agent desk. */
export function DeskTabBar({ tab, onChange }: { tab: string; onChange: (t: string) => void }) {
  return (
    <nav aria-label="ডেস্ক নেভিগেশন" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ tab: t, label, Icon }) => {
          const active = tab === t;
          return (
            <li key={t}>
              <button type="button" onClick={() => { onChange(t); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                aria-current={active ? "page" : undefined}
                className={`flex w-full flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
                <Icon className="size-5" aria-hidden />{label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
