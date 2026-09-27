import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { searchDeckLeads } from "@/lib/lead-pool.functions";
import { getAdminToken } from "@/lib/local-session";

const STATUS_LABEL: Record<string, string> = {
  pending: "কল বাকি",
  contacted: "যোগাযোগ হয়েছে",
  follow_up: "ফলো-আপ",
  closed: "বন্ধ",
};

type Agent = { id: string; name: string };

/** Search by reference, serial, phone or name; filter by agent, status, source. */
export function DeckLeadSearch({ agents, full }: { agents: Agent[]; full: boolean }) {
  const search = useServerFn(searchDeckLeads);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"pool" | "all">("pool");
  const [agentId, setAgentId] = useState("any");
  const [status, setStatus] = useState("any");
  const [source, setSource] = useState("any");

  const query = useQuery({
    queryKey: ["deck-leads", q, scope, agentId, status, source],
    queryFn: () =>
      search({
        data: {
          adminToken: getAdminToken() ?? null,
          q: q || undefined,
          scope: full ? scope : "pool",
          agentId: agentId === "any" ? null : agentId,
          status: status === "any" ? null : (status as "pending"),
          source: source === "any" ? null : source,
        },
      }),
    staleTime: 15_000,
  });

  const rows = query.data?.rows ?? [];

  return (
    <section className="card-elevated p-4" aria-labelledby="deck-search-title">
      <h2 id="deck-search-title" className="text-sm font-semibold">
        লিড খুঁজুন / Lead search
      </h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input
            aria-label="রেফারেন্স, সিরিয়াল, ফোন বা নাম"
            placeholder="রেফারেন্স, সিরিয়াল, ফোন বা নাম"
            className="pl-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {full ? (
          <Select value={scope} onValueChange={(v) => setScope(v as "pool" | "all")}>
            <SelectTrigger aria-label="কোথায় খুঁজবেন">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pool">হেড পুল (অবণ্টিত)</SelectItem>
              <SelectItem value="all">সব লিড</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        {full && scope === "all" ? (
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger aria-label="এজেন্ট">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">সব এজেন্ট</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="অবস্থা">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">সব অবস্থা</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger aria-label="উৎস">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">সব উৎস</SelectItem>
            <SelectItem value="head_database">হেড ডেটাবেজ</SelectItem>
            <SelectItem value="lead_database">লিড ডেটাবেজ</SelectItem>
            <SelectItem value="agent_app">এজেন্ট অ্যাপ</SelectItem>
            <SelectItem value="webhook">ওয়েব ফর্ম</SelectItem>
            <SelectItem value="csv_import">CSV ইমপোর্ট</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface-2 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">সিরিয়াল</th>
              <th className="px-3 py-2 text-left">রেফারেন্স</th>
              <th className="px-3 py-2 text-left">নাম</th>
              <th className="px-3 py-2 text-left">ফোন</th>
              <th className="px-3 py-2 text-left">অবস্থা</th>
              <th className="px-3 py-2 text-left">উৎস</th>
              <th className="px-3 py-2 text-left">এজেন্ট</th>
            </tr>
          </thead>
          <tbody>
            {query.isPending ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-4 animate-spin" aria-label="লোড হচ্ছে" />
                </td>
              </tr>
            ) : query.isError ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-destructive">
                  লিড আনা যায়নি — {(query.error as Error).message}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  কোনো লিড পাওয়া যায়নি / No leads match
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border/70">
                  <td className="tabular px-3 py-2">#{r.serial_no ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">{r.reference_by ?? "—"}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="tabular px-3 py-2">{r.phone_number}</td>
                  <td className="px-3 py-2">{STATUS_LABEL[r.status] ?? r.status}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.source}</td>
                  <td className="px-3 py-2">{r.agentName ?? "হেড পুল"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {rows.length === 100 ? (
        <p className="mt-2 text-xs text-muted-foreground">প্রথম ১০০টি দেখানো হচ্ছে — খোঁজ আরও নির্দিষ্ট করুন।</p>
      ) : null}
    </section>
  );
}
