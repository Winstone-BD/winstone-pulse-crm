import { PhoneCall, Timer, TrendingUp, Users } from "lucide-react";

import { CONNECTED_THRESHOLD_SECONDS, type CallRecording, type Lead } from "@/lib/crm-data";
import { formatTalkTime } from "@/lib/crm-format";
import type { DrillSpec } from "@/components/crm/HqDrillSheet";

import { StatTile } from "./StatTile";

/** Top-row headline KPI tiles: total calls, talk time, active leads, deals won. */
export function HqStatTiles({
  calls,
  leads,
  messages,
  onDrill,
}: {
  calls: CallRecording[];
  leads: Lead[];
  messages: { length: number };
  onDrill: (spec: DrillSpec) => void;
}) {
  const connected = calls.filter((c) => c.duration_seconds > CONNECTED_THRESHOLD_SECONDS).length;
  const talkSeconds = calls.reduce((sum, c) => sum + c.duration_seconds, 0);
  const unassigned = leads.filter((l) => l.assigned_to === null).length;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        icon={<PhoneCall className="size-4" />}
        label="মোট কল"
        value={String(calls.length)}
        hint={`${connected}টি কল ${CONNECTED_THRESHOLD_SECONDS} সেকেন্ডের বেশি কথা হয়েছে`}
        onOpen={() =>
          onDrill({
            title: "মোট কল",
            subtitle: "সব সিঙ্ক হওয়া কল — নাম চাপলে লিডের পুরো ফাইল",
            kind: "calls",
            calls,
          })
        }
      />
      <StatTile
        icon={<Timer className="size-4" />}
        label="ফ্লোরের কথার সময়"
        value={formatTalkTime(talkSeconds)}
        hint="সব সিঙ্ক হওয়া রেকর্ডিং মিলিয়ে"
        onOpen={() =>
          onDrill({
            title: "কথা হওয়া কল",
            subtitle: `${CONNECTED_THRESHOLD_SECONDS} সেকেন্ডের বেশি কথা হওয়া কল`,
            kind: "calls",
            calls: calls.filter((c) => c.duration_seconds > CONNECTED_THRESHOLD_SECONDS),
          })
        }
      />
      <StatTile
        icon={<Users className="size-4" />}
        label="চালু লিড"
        value={String(leads.filter((l) => l.status !== "closed").length)}
        hint={`${unassigned}টি লিড এখনো কারো নামে দেওয়া হয়নি`}
        onOpen={() =>
          onDrill({
            title: "চালু লিড",
            subtitle: "যেসব লিড এখনো বন্ধ হয়নি",
            kind: "leads",
            leads: leads.filter((l) => l.status !== "closed"),
          })
        }
      />
      <StatTile
        icon={<TrendingUp className="size-4" />}
        label="ডিল জেতা"
        value={String(
          leads.filter((l) => l.status === "closed" && l.outcome_category === "deal_won").length,
        )}
        hint={`${messages.length}টি হোয়াটসঅ্যাপ মেসেজ জমা আছে`}
        onOpen={() =>
          onDrill({
            title: "ডিল জেতা লিড",
            subtitle: "বন্ধ হওয়া ও ডিল জেতা লিড",
            kind: "leads",
            leads: leads.filter((l) => l.status === "closed" && l.outcome_category === "deal_won"),
          })
        }
      />
    </div>
  );
}
