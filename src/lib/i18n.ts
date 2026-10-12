import { useSyncExternalStore } from "react";

/** UI language. English is the default; Bengali is a full alternative. A saved choice always wins. */
export type Lang = "bn" | "en";
const KEY = "winstone.lang";
const listeners = new Set<() => void>();

function read(): Lang {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(KEY) === "bn" ? "bn" : "en";
}

export function setLang(lang: Lang) {
  window.localStorage.setItem(KEY, lang);
  document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "en",
  );
}

/** Pick the right string: t({ bn, en }). */
export function useT() {
  const lang = useLang();
  return (s: { bn: string; en: string }) => s[lang];
}

export const NAV_LABELS: Record<string, { bn: string; en: string }> = {
  "/": { bn: "হোম", en: "Home" },
  "/desk": { bn: "আমার ডেস্ক", en: "My Desk" },
  "/coach": { bn: "এআই কোচ", en: "AI Coach" },
  "/leadhub": { bn: "লিডহাব নেক্সাস", en: "LeadHub Nexus" },
  "/hq": { bn: "এক্সিকিউটিভ HQ", en: "Executive HQ" },
  "/sales-intel": { bn: "সেলস ইন্টেলিজেন্স", en: "Sales Intelligence" },
  "/news": { bn: "মার্কেট নিউজ", en: "Market News" },
  "/site-visits": { bn: "সাইট ভিজিট", en: "Site Visits" },
  "/inventory": { bn: "ইনভেন্টরি", en: "Inventory" },
  "/reports": { bn: "রিপোর্ট", en: "Reports" },
  "/system": { bn: "আইটি কনসোল", en: "IT Console" },
  "/runtime-errors": { bn: "রানটাইম এরর", en: "Runtime Errors" },
  "/ingest": { bn: "ইনজেস্ট চেক", en: "Ingest Check" },
  "/migration": { bn: "মাইগ্রেশন চেকলিস্ট", en: "Migration Checklist" },
  "/migration-export": { bn: "মাইগ্রেশন এক্সপোর্ট", en: "Migration Export" },
  "/security": { bn: "পিন ও অ্যাক্সেস", en: "PIN & Access" },
  "/docs": { bn: "ডকস", en: "Docs" },
  "/docs-admin": { bn: "ডকস অ্যাডমিন", en: "Docs Admin" },
  "/inbox": { bn: "সাপোর্ট ইনবক্স", en: "Support Inbox" },
  "/tickets": { bn: "টিকিট", en: "Tickets" },
  "/customers": { bn: "কাস্টমার", en: "Customers" },
  "/support-admin": { bn: "সাপোর্ট অ্যাডমিন", en: "Support Admin" },
  "/help": { bn: "সহায়তা কেন্দ্র", en: "Help Centre" },
};
