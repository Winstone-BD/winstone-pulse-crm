import { Link } from "@tanstack/react-router";
import { Check, UserPlus } from "lucide-react";
import headPortrait from "@/assets/it-head-zahid.asset.json";
import officerPortrait from "@/assets/it-officer-nafs.asset.json";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export function ItOfficerPicker({ selected, onSelect }: { selected: string | null; onSelect: (name: string) => void }) {
  const t = useT();
  const officers = [
    { name: "Zahid Hasan Emon", role: t({ en: "Head of IT", bn: "আইটি প্রধান" }), portrait: headPortrait.url },
    { name: "Nafs Ul Haque", role: t({ en: "IT Officer", bn: "আইটি অফিসার" }), portrait: officerPortrait.url },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3" aria-label={t({ en: "IT team", bn: "আইটি টিম" })}>
        {officers.map((officer) => (
          <Button key={officer.name} type="button" variant="outline" aria-pressed={selected === officer.name}
            onClick={() => onSelect(officer.name)}
            className={`relative h-auto min-w-0 flex-col gap-0 overflow-hidden rounded-lg p-0 text-left whitespace-normal ${selected === officer.name ? "border-gold ring-1 ring-gold" : "border-border"}`}>
            <img src={officer.portrait} alt={officer.name} className="aspect-[4/3] w-full object-cover object-top" />
            <span className="w-full p-3">
              <span className="block text-[10px] font-medium uppercase text-gold">{officer.role}</span>
              <span className="mt-1 block text-sm font-semibold text-foreground">{officer.name}</span>
            </span>
            {selected === officer.name && <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3.5" /></span>}
          </Button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <span className="text-xs text-muted-foreground">{t({ en: "IT Assistant", bn: "আইটি অ্যাসিস্ট্যান্ট" })}</span>
        <Button asChild size="sm" variant="ghost"><Link to="/support"><UserPlus className="size-4" />{t({ en: "Request account", bn: "অ্যাকাউন্টের আবেদন" })}</Link></Button>
      </div>
    </div>
  );
}