import { BarChart3 } from "lucide-react";

/** Page title strip for the Control Board (HQ) page. */
export function HqHeader() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/25">
          <BarChart3 className="size-6" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
            সেলস কমান্ড সেন্টার
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            দেখুন → বুঝুন → ক্লিক করুন → কাজ করুন। সব সংখ্যা আসল রেকর্ড থেকে।
          </p>
        </div>
      </div>
      <p className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
        শুধু দেখার ভিউ · লিড অ্যাসাইন হয় LeadHub থেকে
      </p>
    </div>
  );
}
