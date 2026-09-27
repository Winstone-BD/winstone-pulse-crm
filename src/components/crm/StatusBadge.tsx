import { TONE_CLASS, type Tone } from "@/lib/crm-taxonomy";

/** The one badge used for every CRM state (lifecycle, call, temperature, grade, follow-up). */
export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}
