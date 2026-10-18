import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminToken } from "@/lib/local-session";
import { grantExtraLeadsToAll, quotaOverview } from "@/lib/lead-pool.functions";

/** IT Console: the same extra-lead batch for every active agent, with reason + quota warning. */
export function BulkExtraLeadPanel() {
  const qc = useQueryClient();
  const load = useServerFn(quotaOverview);
  const grant = useServerFn(grantExtraLeadsToAll);
  const [quantity, setQuantity] = useState(30);
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [last, setLast] = useState<{ name: string; moved: number; error: string | null }[] | null>(null);

  const query = useQuery({
    queryKey: ["quota-overview"],
    queryFn: () => load({ data: { adminToken: getAdminToken() } }),
    refetchInterval: 30_000,
  });
  const rows = query.data?.rows ?? [];
  const over = rows.filter((r) => r.assignedToday + r.extraToday + quantity > r.baseQuota);
  const reasonOk = reason.trim().length >= 5;

  const run = useMutation({
    mutationFn: () =>
      grant({ data: { adminToken: getAdminToken(), quantity, reason: reason.trim(), acknowledgeOverQuota: true, requestId, expectedAgentIds: rows.map((r) => r.id) } }),
    onSuccess: (res) => {
      setLast(res.results);
      toast.success(`${res.results.length} জন এজেন্টকে মোট ${res.moved}টি অতিরিক্ত লিড · ডেটাবেজে বাকি ${res.remaining}`);
      setReason("");
      setAck(false);
      setConfirming(false);
      setRequestId(crypto.randomUUID());
      for (const key of ["quota-overview", "lead-pool", "lead-pool-status", "crm-snapshot", "coord-allocation"])
        void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="card-elevated space-y-3 p-4">
      <div className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-full bg-primary/15 text-primary">
          <Users className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">সবাইকে একসাথে অতিরিক্ত লিড</h2>
          <p className="text-xs text-muted-foreground">
            প্রতিটি সক্রিয় এজেন্ট ({rows.length} জন) একই সংখ্যক লিড পাবে — প্রতিটি অডিটে আলাদা লেখা থাকবে।
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
        <Input
          type="number"
          min={1}
          max={100}
          aria-label="প্রতি এজেন্ট অতিরিক্ত লিড"
          value={quantity}
          onChange={(e) => {
            setQuantity(Math.min(100, Math.max(1, Number(e.target.value) || 1)));
            setConfirming(false);
          }}
        />
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="কারণ (আবশ্যক, কমপক্ষে ৫ অক্ষর — অডিটে থাকবে)"
          maxLength={300}
        />
      </div>

      {over.length > 0 && (
        <div role="alert" className="space-y-1 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
          <p className="flex items-center gap-1 font-semibold">
            <AlertTriangle className="size-4" /> কোটা সতর্কতা: {over.length} জন এজেন্ট দৈনিক কোটার বেশি পাবেন
          </p>
          <ul className="grid gap-0.5 sm:grid-cols-2">
            {over.map((r) => (
              <li key={r.id}>
                {r.name}: আজ {r.assignedToday + r.extraToday} + {quantity} ={" "}
                {r.assignedToday + r.extraToday + quantity} (কোটা {r.baseQuota})
              </li>
            ))}
          </ul>
          <label className="mt-1 flex items-center gap-2 font-medium">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            বুঝেছি — কোটার বাইরে অতিরিক্ত লিড দিতে চাই
          </label>
        </div>
      )}

      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
          <div className="w-full">
            <p className="font-semibold">Preview — প্রতি জন {quantity}টি অতিরিক্ত (আগের লিড অপরিবর্তিত)</p>
            <ul className="mt-1 grid gap-0.5 text-xs sm:grid-cols-2">
              {rows.map((r) => (
                <li key={r.id}>
                  {r.employeeId ?? ""} {r.name}: {r.assignedToday + r.extraToday} → {r.assignedToday + r.extraToday + quantity}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-muted-foreground">
              {rows.length} জন × {quantity} = সর্বোচ্চ {rows.length * quantity}টি · যোগ্য লিড কম থাকলে কম যাবে
            </p>
          </div>
          <Button size="sm" onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? <Loader2 className="size-4 animate-spin" /> : null} নিশ্চিত করুন
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setConfirming(false)} disabled={run.isPending}>
            বাতিল
          </Button>
        </div>
      ) : (
        <Button
          disabled={!rows.length || !reasonOk || (over.length > 0 && !ack)}
          onClick={() => setConfirming(true)}
        >
          সবাইকে {quantity}টি করে দেখুন
        </Button>
      )}
      {!reasonOk && <p className="text-xs text-muted-foreground">কারণ না লিখলে পাঠানো যাবে না।</p>}

      {last && (
        <ul className="space-y-0.5 text-xs">
          {last.map((r) => (
            <li key={r.name} className={r.error ? "text-destructive" : undefined}>
              {r.name}: {r.error ? `আটকে গেছে — ${r.error}` : `${r.moved}টি`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
