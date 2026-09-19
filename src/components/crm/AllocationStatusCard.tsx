import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRightLeft, CalendarClock, Inbox, Target } from "lucide-react";

import { floorAllocation, myAllocationStatus } from "@/lib/allocation.functions";
import { useAdminToken } from "@/lib/admin-token";
import { useMyAccount } from "@/lib/session";

/**
 * Today's workload, exactly as the server counted it.
 *
 * Nothing here is calculated in the browser: the counts, the target, the excess
 * and the shortage all come from the same server call the Android app uses, so
 * the phone and the web can never show different numbers. Carried-over work is
 * named with the day it came from, excess leads are shown rather than hidden,
 * and a shortage is stated truthfully instead of being padded.
 */
function dhakaDate(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("bn-BD", {
    day: "numeric",
    month: "long",
  });
}

function Chip({
  icon,
  label,
  value,
  tone = "muted",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "muted" | "warning" | "primary";
}) {
  const toneClass =
    tone === "warning"
      ? "border-warning/40 bg-warning/5 text-warning"
      : tone === "primary"
        ? "border-primary/40 bg-primary/5 text-primary"
        : "border-border bg-surface text-muted-foreground";
  return (
    <div className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 ${toneClass}`}>
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-medium opacity-80">{label}</span>
        <span className="tabular block text-sm font-semibold">{value}</span>
      </span>
    </div>
  );
}

/** The signed-in agent's own workday allocation. */
export function MyAllocationCard() {
  const adminToken = useAdminToken();
  const { scope } = useMyAccount();
  const query = useQuery({
    queryKey: ["my-allocation", adminToken ? "pin" : "session"],
    queryFn: () => myAllocationStatus({ data: { adminToken } }),
    enabled: scope !== "none",
    retry: false,
    refetchOnWindowFocus: true,
  });

  const data = query.data;
  const me = data?.me;
  if (!me) return null;

  return (
    <section className="card-elevated card-pad section-stack">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <h2 className="section-title truncate">আজকের কাজের হিসাব</h2>
        <span className="tabular shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-semibold">
          {me.pending} / {me.quota}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Chip
          icon={<Target className="size-4" />}
          label="আজকের লক্ষ্য"
          value={`${me.quota}টি`}
          tone="primary"
        />
        <Chip
          icon={<CalendarClock className="size-4" />}
          label={
            me.carriedFrom ? `আগের দিনের বাকি (${dhakaDate(me.carriedFrom)})` : "আগের দিনের বাকি"
          }
          value={`${me.carriedOver}টি`}
          tone={me.carriedOver > 0 ? "warning" : "muted"}
        />
        <Chip
          icon={<Inbox className="size-4" />}
          label="ডেটাবেজ থেকে নতুন"
          value={`${me.newFromDatabase}টি`}
        />
        <Chip
          icon={<ArrowRightLeft className="size-4" />}
          label="অন্যের থেকে পাওয়া"
          value={`${me.receivedFromOthers}টি`}
        />
      </div>

      {me.excess > 0 ? (
        <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/5 p-3 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            লক্ষ্যের চেয়ে <strong className="tabular">{me.excess}টি</strong> বেশি পেন্ডিং লিড আছে
            (অতিরিক্ত/মীমাংসাধীন)। একটি লিডও মুছে যায়নি — কাজ শুরু না হওয়া অতিরিক্ত লিড কম চাপে
            থাকা সহকর্মীর কাছে যেতে পারে, বাকিগুলো আপনার তালিকাতেই থাকবে।
          </span>
        </p>
      ) : null}

      {me.movedToOthers > 0 ? (
        <p className="text-xs text-muted-foreground">
          আজ আপনার <span className="tabular">{me.movedToOthers}টি</span> অতিরিক্ত লিড ভারসাম্যের
          জন্য সহকর্মীর কাছে গেছে — পুরনো ইতিহাস লিডের টাইমলাইনে আছে।
        </p>
      ) : null}

      {me.gap > 0 ? (
        <p className="text-xs text-muted-foreground">
          লক্ষ্য পূরণে আর <span className="tabular">{me.gap}টি</span> লিড দরকার।
          {data?.shortage
            ? ` ডেটাবেজে এখন ${data.poolAvailable}টি লিড আছে — ${data.shortage}টির ঘাটতি, তাই সবাইকে পূর্ণ তালিকা দেওয়া যাচ্ছে না।`
            : " পরের স্বয়ংক্রিয় বণ্টনে এগুলো যোগ হবে।"}
        </p>
      ) : null}
    </section>
  );
}

/** Whole-floor view for coordinators, Executive HQ and the IT Console. */
export function FloorAllocationPanel() {
  const adminToken = useAdminToken();
  const { scope } = useMyAccount();
  const mayRead = scope !== "none" && scope !== "agent";
  const query = useQuery({
    queryKey: ["floor-allocation", adminToken ? "pin" : "session"],
    queryFn: () => floorAllocation({ data: { adminToken } }),
    enabled: mayRead,
    retry: false,
  });

  const data = query.data;
  if (!mayRead || !data) return null;

  return (
    <section className="card-elevated card-pad section-stack">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <h2 className="section-title truncate">আজকের বণ্টনের হিসাব — সব ডেস্ক</h2>
        <span className="tabular shrink-0 text-xs text-muted-foreground">
          ডেটাবেজে {data.poolAvailable}টি
        </span>
      </header>

      <p className="text-xs text-muted-foreground">
        প্রতিটি সংখ্যা সার্ভারের হিসাব — ওয়েব আর ফোনের অ্যাপে একই দেখাবে। আগের দিনের বাকি লিড আগে
        গণনা হয়, তারপর ঘাটতি অনুযায়ী ডেটাবেজ থেকে যোগ হয়; একটি লিড দুইবার গোনা হয় না।
        {data.shortage > 0
          ? ` আজ ${data.requested}টি দরকার, ঘাটতি ${data.shortage}টি।`
          : ""}
      </p>

      <div className="table-scroll">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-2 py-2 text-left font-medium">ডেস্ক</th>
              <th className="px-2 py-2 text-right font-medium">লক্ষ্য</th>
              <th className="px-2 py-2 text-right font-medium">পেন্ডিং</th>
              <th className="px-2 py-2 text-right font-medium">আগের দিনের</th>
              <th className="px-2 py-2 text-right font-medium">নতুন</th>
              <th className="px-2 py-2 text-right font-medium">পাওয়া/দেওয়া</th>
              <th className="px-2 py-2 text-right font-medium">শেষ</th>
              <th className="px-2 py-2 text-right font-medium">অবস্থা</th>
            </tr>
          </thead>
          <tbody>
            {data.agents.map((row) => (
              <tr key={row.agentId} className="border-b border-border/60 last:border-0">
                <td className="max-w-[180px] truncate px-2 py-2 font-medium">{row.name}</td>
                <td className="tabular px-2 py-2 text-right">{row.quota}</td>
                <td className="tabular px-2 py-2 text-right font-semibold">{row.pending}</td>
                <td className="tabular px-2 py-2 text-right">{row.carriedOver}</td>
                <td className="tabular px-2 py-2 text-right">{row.newFromDatabase}</td>
                <td className="tabular px-2 py-2 text-right">
                  {row.receivedFromOthers}/{row.movedToOthers}
                </td>
                <td className="tabular px-2 py-2 text-right">{row.completed}</td>
                <td className="px-2 py-2 text-right text-xs">
                  {row.state === "excess" ? (
                    <span className="font-semibold text-warning">অতিরিক্ত {row.excess}টি</span>
                  ) : row.state === "short" ? (
                    <span className="text-muted-foreground">ঘাটতি {row.gap}টি</span>
                  ) : (
                    <span className="text-primary">লক্ষ্য পূর্ণ</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
