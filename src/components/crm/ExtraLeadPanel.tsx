import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PlusCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAdminToken } from "@/lib/local-session";
import { grantExtraLeadPool, quotaOverview } from "@/lib/lead-pool.functions";

/**
 * Extra leads above the base daily quota, for the IT Console and the
 * Coordinator Deck. The base quota itself never changes — extra batches are
 * counted separately so performance stays honest.
 */
export function ExtraLeadPanel() {
  const queryClient = useQueryClient();
  const load = useServerFn(quotaOverview);
  const grant = useServerFn(grantExtraLeadPool);

  const [agentId, setAgentId] = useState("");
  const [quantity, setQuantity] = useState(5);
  const [reason, setReason] = useState("");

  const query = useQuery({
    queryKey: ["quota-overview"],
    queryFn: () => load({ data: { adminToken: getAdminToken() } }),
    refetchInterval: 30_000,
  });

  const mutation = useMutation({
    mutationFn: () =>
      grant({
        data: { adminToken: getAdminToken(), agentProfileId: agentId, quantity, reason: reason || null },
      }),
    onSuccess: (result) => {
      toast.success(`${result.moved}টি অতিরিক্ত লিড দেওয়া হয়েছে · ডেটাবেজে বাকি ${result.remaining}`);
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["quota-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["lead-pool-status"] });
      void queryClient.invalidateQueries({ queryKey: ["crm-snapshot"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = query.data?.rows ?? [];

  return (
    <section className="card-elevated space-y-3 p-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <PlusCircle className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">অতিরিক্ত লিড</h2>
          <p className="text-xs text-muted-foreground">
            দৈনিক কোটার বাইরে বাড়তি লিড — কোটা বদলায় না, আলাদাভাবে হিসাব থাকে।
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_100px_auto]">
        <Select value={agentId} onValueChange={setAgentId}>
          <SelectTrigger>
            <SelectValue placeholder="এজেন্ট বাছুন" />
          </SelectTrigger>
          <SelectContent>
            {rows.map((row) => (
              <SelectItem key={row.id} value={row.id}>
                {row.name} — কোটা {row.baseQuota}
                {row.extraToday > 0 ? ` + অতিরিক্ত ${row.extraToday}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={1}
          max={200}
          value={quantity}
          onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
        />
        <Button
          disabled={!agentId || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="whitespace-nowrap"
        >
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "দিন"}
        </Button>
      </div>
      <Input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="কারণ (অডিটে লেখা থাকবে)"
        maxLength={300}
      />

      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="p-2 text-left font-medium">এজেন্ট</th>
                <th className="p-2 text-right font-medium">দৈনিক কোটা</th>
                <th className="p-2 text-right font-medium">আজ অতিরিক্ত</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="p-2">
                    <span className="block truncate">{row.name}</span>
                    <span className="text-muted-foreground">{row.employeeId ?? "—"}</span>
                  </td>
                  <td className="p-2 text-right tabular-nums">{row.baseQuota}</td>
                  <td className="p-2 text-right tabular-nums">{row.extraToday}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
