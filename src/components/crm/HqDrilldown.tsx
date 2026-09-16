import { Inbox, PhoneOutgoing } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/** One row inside a drilldown list. */
export type DrillRow = {
  id: string;
  leadId: string | null;
  primary: string;
  secondary: string;
  meta: string;
};

export type Drilldown = {
  title: string;
  subtitle: string;
  rows: DrillRow[];
};

/** Full-screen (mobile) / side (desktop) list behind every HQ card. */
export function HqDrilldown({
  drill,
  open,
  onOpenChange,
  onSelectLead,
}: {
  drill: Drilldown | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onSelectLead: (leadId: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="inset-0 h-full max-h-full w-full max-w-full overflow-y-auto p-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border px-4 py-4 text-left sm:px-6">
          <SheetTitle className="text-base leading-snug sm:text-lg">
            {drill?.title ?? "বিস্তারিত"}
          </SheetTitle>
          <SheetDescription className="text-xs leading-relaxed sm:text-sm">
            {drill?.subtitle ?? ""}
          </SheetDescription>
        </SheetHeader>

        {!drill || drill.rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-surface-2 text-muted-foreground">
              <Inbox className="size-5" />
            </span>
            <p className="text-sm font-medium">এই ভিউতে কোনো তথ্য নেই</p>
            <p className="text-xs text-muted-foreground">
              অন্য কার্ডে চাপুন বা কাজ জমা হলে আবার দেখুন।
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {drill.rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  disabled={!row.leadId}
                  onClick={() => row.leadId && onSelectLead(row.leadId)}
                  className="flex w-full min-h-11 items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 disabled:cursor-default sm:px-6"
                >
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary/12 text-primary ring-1 ring-primary/25">
                    <PhoneOutgoing className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium leading-snug">
                      {row.primary}
                    </span>
                    <span className="block truncate text-xs leading-relaxed text-muted-foreground">
                      {row.secondary}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-[11px] leading-relaxed text-muted-foreground">
                    {row.meta}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
