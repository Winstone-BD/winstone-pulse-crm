import type { DrillSpec } from "@/components/crm/HqDrillSheet";

import { MixCard, type MixRow } from "./MixCard";

/** Funnel and source intelligence cards, each drilling into its rows. */
export function HqMixCards({
  funnelRows,
  sourceRows,
  loading,
  onDrill,
}: {
  funnelRows: MixRow[];
  sourceRows: MixRow[];
  loading: boolean;
  onDrill: (spec: DrillSpec) => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <MixCard
        title="লিড ফানেল"
        subtitle="নতুন লিড থেকে ডিল পর্যন্ত"
        rows={funnelRows}
        loading={loading}
        onSelectRow={(row) =>
          onDrill({
            title: `ফানেল · ${row.label}`,
            subtitle: "এই ধাপের সব লিড",
            kind: "leads",
            leads: row.leads ?? [],
          })
        }
      />
      <MixCard
        title="লিড কোথা থেকে"
        subtitle="সোর্স অনুযায়ী ভাগ"
        rows={sourceRows}
        loading={loading}
        onSelectRow={(row) =>
          onDrill({
            title: `সোর্স · ${row.label}`,
            subtitle: "এই সোর্স থেকে আসা লিড",
            kind: "leads",
            leads: row.leads ?? [],
          })
        }
      />
    </div>
  );
}
