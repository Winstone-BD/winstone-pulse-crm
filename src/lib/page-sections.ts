import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback } from "react";

/** Sub-pages of the three big workspaces, shared by the sidebar and each page. */
export const PAGE_SECTIONS = {
  "/hq": [
    { key: "overview", label: "ওভারভিউ" },
    { key: "lead360", label: "Lead 360" },
    { key: "followups", label: "ফলো-আপ ও রিপোর্ট" },
    { key: "performance", label: "এজেন্ট পারফরম্যান্স" },
    { key: "leads", label: "লিড ও ফানেল" },
    { key: "tools", label: "জবাবদিহি ও টুলস" },
  ],
  "/desk": [
    { key: "today", label: "আজকের কাজ" },
    { key: "leads", label: "আমার লিড" },
    { key: "queue", label: "কার্ড ভিউ" },
    { key: "calls", label: "কল রেকর্ড" },
    { key: "whatsapp", label: "হোয়াটসঅ্যাপ" },
    { key: "calendar", label: "ফলো-আপ ক্যালেন্ডার" },
    { key: "reports", label: "আমার রিপোর্ট" },
    { key: "support", label: "টিম সাপোর্ট" },
  ],
  "/sales-intel": [
    { key: "pitchbook", label: "AI Sales Brief ও Pitchbook" },
    { key: "objections", label: "Objection Library" },
    { key: "history", label: "Pitch History" },
    { key: "market", label: "Market Intelligence" },
    { key: "effectiveness", label: "Pitch Effectiveness" },
    { key: "admin", label: "Knowledge Admin" },
  ],
  "/system": [
    { key: "health", label: "সিস্টেম হেলথ", en: "System Health" },
    { key: "leads", label: "লিড ডেটাবেস", en: "Lead Database" },
    { key: "calls", label: "কল ও রেকর্ডিং", en: "Calls & Recordings" },
    { key: "knowledge", label: "নলেজ (ওয়েবসাইট ও ড্রাইভ)", en: "Knowledge (Website & Drive)" },
    { key: "notices", label: "নোটিশ ও সাপোর্ট", en: "Notices & Support" },
    { key: "access", label: "অ্যাকাউন্ট ও অ্যাক্সেস", en: "Accounts & Access" },
    { key: "releases", label: "অ্যাপ ও রিলিজ", en: "Apps & Releases" },
    { key: "billing", label: "বিল ও অডিট", en: "Billing & Audit" },
  ],
} as const;

export type SectionRoute = keyof typeof PAGE_SECTIONS;
export type SectionKey<R extends SectionRoute> = (typeof PAGE_SECTIONS)[R][number]["key"];

export const sectionSearch = (s: Record<string, unknown>): { s?: string; lead?: string } => ({
  ...(typeof s["s"] === "string" ? { s: s["s"] } : {}),
  ...(typeof s["lead"] === "string" && /^[0-9a-f-]{36}$/i.test(s["lead"]) ? { lead: s["lead"] } : {}),
});

export function useSection<R extends SectionRoute>(route: R): [SectionKey<R>, (k: SectionKey<R>) => void] {
  const raw = useRouterState({ select: (st) => String((st.location.search as Record<string, unknown>)["s"] ?? "") });
  const list = PAGE_SECTIONS[route] as readonly { key: string }[];
  const current = (list.find((x) => x.key === raw)?.key ?? list[0]!.key) as SectionKey<R>;
  const navigate = useNavigate();
  const set = useCallback(
    (k: SectionKey<R>) => {
      void navigate({ to: route, search: { s: k } } as never);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [navigate, route],
  );
  return [current, set];
}
