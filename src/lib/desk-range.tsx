import { useNavigate, useRouterState } from "@tanstack/react-router";
import { CalendarRange, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLang, useT } from "@/lib/i18n";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type DeskRange = { from: string | undefined; to: string | undefined };

/** Reads ?from=&to= (YYYY-MM-DD, Asia/Dhaka, inclusive) from the URL. */
export function useDeskRange(): DeskRange & { active: boolean; inRange: (iso: string | null | undefined) => boolean } {
  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  const from = typeof search["from"] === "string" && DAY.test(search["from"]) ? search["from"] : undefined;
  const to = typeof search["to"] === "string" && DAY.test(search["to"]) ? search["to"] : undefined;
  const start = from ? Date.parse(`${from}T00:00:00+06:00`) : -Infinity;
  const end = to ? Date.parse(`${to}T23:59:59.999+06:00`) : Infinity;
  return {
    from,
    to,
    active: Boolean(from || to),
    inRange: (iso) => {
      if (!from && !to) return true;
      if (!iso) return false;
      const t = Date.parse(iso);
      return t >= start && t <= end;
    },
  };
}

const fmt = (d: string, lang: "bn" | "en") =>
  new Date(`${d}T12:00:00+06:00`).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short" });

/** Visible chip with a clear action; keeps other search params. */
export function DeskRangeChip() {
  const { from, to, active } = useDeskRange();
  const navigate = useNavigate();
  const t = useT();
  const lang = useLang();
  if (!active) return null;
  const label = `${from ? fmt(from, lang) : t({ bn: "শুরু", en: "Start" })} – ${to ? fmt(to, lang) : t({ bn: "আজ", en: "Today" })}`;
  return (
    <div role="status" className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 py-1 pl-3 pr-1 text-xs font-semibold text-primary">
      <CalendarRange className="size-3.5" aria-hidden />
      {t({ bn: "তারিখ", en: "Dates" })}: {label}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 gap-1 rounded-full px-2 text-[11px]"
        onClick={() =>
          void navigate({
            to: ".",
            search: (prev: Record<string, unknown>) => {
              const { from: _f, to: _t, ...rest } = prev;
              return rest;
            },
          } as never)
        }
        aria-label={t({ bn: "তারিখের সীমা সরান", en: "Clear date range" })}
      >
        <X className="size-3" /> {t({ bn: "সরান", en: "Clear" })}
      </Button>
    </div>
  );
}
