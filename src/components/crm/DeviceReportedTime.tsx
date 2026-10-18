import { useLang } from "@/lib/i18n";

export function DeviceReportedTime({ seconds }: { seconds: number | null | undefined }) {
  const lang = useLang();
  if (seconds == null) return null;
  return <p className="text-xs text-muted-foreground">{lang === "bn" ? `ফোনের হিসাবে ${seconds} সেকেন্ড — যাচাই করা হয়নি` : `Device-reported ${seconds}s — unverified`}</p>;
}