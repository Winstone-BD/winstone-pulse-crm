import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, Users } from "lucide-react";
import headPortrait from "@/assets/it-head-zahid.asset.json";
import officerPortrait from "@/assets/it-officer-nafs.asset.json";
import { useT } from "@/lib/i18n";

/**
 * Verified sign-in emails per officer. Leave empty until the officer's real
 * account email is confirmed — selecting a profile never grants access.
 */
export const IT_OFFICER_EMAILS: Record<string, string> = {};

export function ItOfficerPicker({ selected, onSelect }: { selected: string | null; onSelect: (name: string) => void }) {
  const t = useT();
  const officers = [
    { name: "Zahid Hasan Emon", role: t({ en: "Head of IT", bn: "আইটি প্রধান" }), portrait: headPortrait.url },
    { name: "Nafs Ul Haque", role: t({ en: "IT Officer", bn: "আইটি অফিসার" }), portrait: officerPortrait.url },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3" role="group" aria-label={t({ en: "Select your profile", bn: "আপনার প্রোফাইল বেছে নিন" })}>
      {officers.map((officer) => {
        const active = selected === officer.name;
        return (
          <button key={officer.name} type="button" aria-pressed={active} onClick={() => onSelect(officer.name)}
            className={`relative flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "border-gold ring-1 ring-gold" : "border-border hover:border-gold/50"}`}>
            <img src={officer.portrait} alt="" className="aspect-[4/3] w-full object-cover object-top" />
            <span className="min-w-0 p-2 sm:p-2.5">
              <span className="block truncate text-xs font-semibold text-foreground sm:text-sm">{officer.name}</span>
              <span className="block truncate text-[10px] font-medium uppercase text-gold">{officer.role}</span>
            </span>
            {active && <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>}
          </button>
        );
      })}
      <Link to="/support" className="flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-card p-2 text-center transition hover:border-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground"><Users className="size-4" /></span>
        <span className="text-xs font-semibold text-foreground">{t({ en: "IT Assistant", bn: "আইটি অ্যাসিস্ট্যান্ট" })}</span>
        <span className="inline-flex items-center text-[11px] font-medium text-gold">{t({ en: "Request account", bn: "অ্যাকাউন্টের আবেদন" })}<ChevronRight className="size-3" /></span>
      </Link>
    </div>
  );
}
