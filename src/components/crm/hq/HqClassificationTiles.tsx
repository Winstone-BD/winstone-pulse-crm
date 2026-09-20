import { Flame, ListChecks, Snowflake } from "lucide-react";

import type { Lead } from "@/lib/crm-data";
import type { DrillSpec } from "@/components/crm/HqDrillSheet";

import { StatTile } from "./StatTile";

/** Classification board: what agents actually decided after talking (hot/warm/cold + pending work). */
export function HqClassificationTiles({
  leads,
  onDrill,
}: {
  leads: Lead[];
  onDrill: (spec: DrillSpec) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {(
        [
          { key: "hot", label: "HOT লিড", hint: "এজেন্টের নিজের সিদ্ধান্ত অনুযায়ী" },
          { key: "warm", label: "WARM লিড", hint: "কিছুটা আগ্রহী" },
          { key: "cold", label: "COLD লিড", hint: "এখন আগ্রহ কম" },
        ] as const
      ).map((t) => (
        <StatTile
          key={t.key}
          icon={t.key === "cold" ? <Snowflake className="size-4" /> : <Flame className="size-4" />}
          label={t.label}
          value={String(leads.filter((l) => l.temperature === t.key).length)}
          hint={t.hint}
          onOpen={() =>
            onDrill({
              title: t.label,
              subtitle: "এজেন্টের শ্রেণিবিন্যাস অনুযায়ী",
              kind: "leads",
              leads: leads.filter((l) => l.temperature === t.key),
            })
          }
        />
      ))}
      <StatTile
        icon={<ListChecks className="size-4" />}
        label="বাকি কাজ (PENDING)"
        value={String(leads.filter((l) => l.work_state !== "completed").length)}
        hint={`${leads.filter((l) => l.work_state === "completed").length}টি লিড শ্রেণিবিন্যাসসহ শেষ`}
        onOpen={() =>
          onDrill({
            title: "বাকি কাজ",
            subtitle: "শ্রেণিবিন্যাস বা কাজ এখনো শেষ হয়নি",
            kind: "leads",
            leads: leads.filter((l) => l.work_state !== "completed"),
          })
        }
      />
    </div>
  );
}
