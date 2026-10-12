import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { LifeBuoy, PhoneCall, Search, User } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { PAGE_SECTIONS } from "@/lib/page-sections";
import { useSnapshot } from "@/lib/crm-data";
import { leadOwner } from "@/lib/lead-owner";
import { useMyAccount } from "@/lib/session";
import { useT } from "@/lib/i18n";

type Item = { to: string; label: string };

const DESK_SECTIONS = PAGE_SECTIONS["/desk"];

/**
 * ⌘K / Ctrl+K command palette: jump to any page the signed-in user can
 * already see, a My Desk section, or one of the agent's/coordinator's own
 * leads by name or phone.
 */
export function CommandPalette({ items, icons }: { items: readonly Item[]; icons: Record<string, LucideIcon> }) {
  const t = useT();
  const navigate = useNavigate();
  const { account, scope } = useMyAccount();
  const snapshot = useSnapshot();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showLeads = (scope === "agent" || scope === "coordinator") && snapshot.leads.length > 0;

  const leadMatches = useMemo(() => {
    if (!showLeads) return [];
    const q = query.trim().toLowerCase();
    const profileId = account?.profile?.id;
    const mine = profileId ? snapshot.leads.filter((l) => leadOwner(l) === profileId) : [];
    const pool = mine.length > 0 ? mine : snapshot.leads;
    const filtered = q
      ? pool.filter((l) => l.name.toLowerCase().includes(q) || l.phone_number.toLowerCase().includes(q))
      : pool;
    return filtered.slice(0, 8);
  }, [showLeads, query, account, snapshot.leads]);

  const go = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const hasDesk = items.some((item) => item.to === "/desk");

  return (
    <>
      <button
        type="button"
        aria-label={t({ bn: "অনুসন্ধান খুলুন", en: "Open search" })}
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-2 text-xs font-semibold text-muted-foreground transition-all duration-300 hover:text-foreground hover:shadow-sm sm:min-w-40 sm:px-3"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="hidden sm:inline">{t({ bn: "খুঁজুন…", en: "Search…" })}</span>
        <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder={t({ bn: "পেজ বা লিড খুঁজুন…", en: "Search pages or leads…" })}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>{t({ bn: "কিছু পাওয়া যায়নি", en: "No results found." })}</CommandEmpty>
          <CommandGroup heading={t({ bn: "পেজসমূহ", en: "Pages" })}>
            {items.map((item) => {
              const Icon = icons[item.to] ?? LifeBuoy;
              return (
                <CommandItem
                  key={item.to}
                  value={`page-${item.to}-${item.label}`}
                  onSelect={() => go(() => void navigate({ to: item.to }))}
                >
                  <Icon />
                  <span>{item.label}</span>
                </CommandItem>
              );
            })}
            {hasDesk &&
              DESK_SECTIONS.map((sec) => (
                <CommandItem
                  key={`desk-${sec.key}`}
                  value={`desk-section-${sec.key}-${sec.en}`}
                  onSelect={() => go(() => void navigate({ to: "/desk", search: { s: sec.key } as never }))}
                >
                  <PhoneCall />
                  <span>{t({ bn: `আমার ডেস্ক · ${sec.label}`, en: `My Desk · ${sec.en}` })}</span>
                </CommandItem>
              ))}
          </CommandGroup>
          {showLeads && leadMatches.length > 0 && (
            <CommandGroup heading={t({ bn: "লিড", en: "Leads" })}>
              {leadMatches.map((lead) => (
                <CommandItem
                  key={lead.id}
                  value={`lead-${lead.id}-${lead.name}-${lead.phone_number}`}
                  onSelect={() =>
                    go(() => void navigate({ to: "/desk", search: { s: "today", lead: lead.id } as never }))
                  }
                >
                  <User />
                  <span className="truncate">{lead.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{lead.phone_number}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
