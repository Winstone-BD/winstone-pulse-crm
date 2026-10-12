import { Check, Copy, Download, QrCode, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useT, useLang } from "@/lib/i18n";

const APK_PATH = "/api/public/download/apk";

type SmokeCheck = { name: string; ok: boolean; status: number | null; detail: string };
type SmokeResult = {
  ok: boolean;
  origin: string;
  checkedAt: string;
  passed: number;
  total: number;
  checks: SmokeCheck[];
};

/**
 * IT Console card: QR code for fast phone install of the agent app plus the
 * automatic post-publish smoke test (APK availability + key CRM routes).
 */
export function ApkInstallCard() {
  const t = useT();
  const lang = useLang();
  const [origin, setOrigin] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<SmokeResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apkUrl = origin ? `${origin}${APK_PATH}` : APK_PATH;

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!origin) return;
    let cancelled = false;
    void (async () => {
      const { default: QRCode } = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(`${origin}${APK_PATH}`, {
        width: 320,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      if (!cancelled) setQr(dataUrl);
    })().catch(() => setQr(null));
    return () => {
      cancelled = true;
    };
  }, [origin]);

  const runSmoke = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/public/smoke", { headers: { accept: "application/json" } });
      setResult((await res.json()) as SmokeResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : t({ bn: "পরীক্ষা চালানো যায়নি", en: "Could not run the check" }));
    } finally {
      setRunning(false);
    }
  }, [t]);

  // Automatic run: every load of the console (i.e. right after a publish) checks the live site.
  useEffect(() => {
    void runSmoke();
  }, [runSmoke]);

  const copy = async () => {
    await navigator.clipboard.writeText(apkUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <QrCode className="size-4 text-primary" /> {t({ bn: "অ্যাপ ইনস্টল ও সিস্টেম পরীক্ষা", en: "App install & system check" })}
      </h2>

      <div className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-2">
          {qr ? (
            <img
              src={qr}
              alt={t({ bn: "এজেন্ট অ্যাপ ডাউনলোড লিংকের QR কোড", en: "QR code for the agent app download link" })}
              className="size-40 rounded-lg border bg-background p-1"
              width={160}
              height={160}
            />
          ) : (
            <div className="flex size-40 items-center justify-center rounded-lg border text-xs text-muted-foreground">
              {t({ bn: "QR তৈরি হচ্ছে…", en: "Generating QR…" })}
            </div>
          )}
          <p className="text-center text-xs text-muted-foreground">
            {t({ bn: "ফোনের ক্যামেরা দিয়ে স্ক্যান করুন", en: "Scan with your phone's camera" })}
          </p>
        </div>

        <div className="min-w-0 space-y-3">
          <p className="text-sm text-muted-foreground">
            {t({
              bn: "QR স্ক্যান করলে সরাসরি এজেন্ট অ্যাপ ডাউনলোড শুরু হবে। ইনস্টলের পর CRM-এর ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন।",
              en: "Scanning the QR starts the agent app download right away. After installing, sign in with your CRM email and password.",
            })}
          </p>
          <code className="block truncate rounded-md bg-muted px-3 py-2 text-xs">{apkUrl}</code>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a href={APK_PATH}>
                <Download className="size-4" /> {t({ bn: "ডাউনলোড", en: "Download" })}
              </a>
            </Button>
            <Button size="sm" variant="outline" onClick={() => void copy()}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? t({ bn: "কপি হয়েছে", en: "Copied" }) : t({ bn: "লিংক কপি", en: "Copy link" })}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void runSmoke()} disabled={running}>
              <RefreshCw className={`size-4 ${running ? "animate-spin" : ""}`} /> {t({ bn: "আবার পরীক্ষা", en: "Re-check" })}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {result?.ok ? (
              <ShieldCheck className="size-4 text-primary" />
            ) : (
              <ShieldAlert className="size-4 text-warning" />
            )}
            {t({ bn: "লাইভ সাইট পরীক্ষা", en: "Live site check" })}
          </h3>
          {result ? (
            <span className="text-xs text-muted-foreground">
              {t({ bn: `${result.passed}/${result.total} ঠিক আছে`, en: `${result.passed}/${result.total} passing` })} ·{" "}
              {new Date(result.checkedAt).toLocaleString(lang === "en" ? "en-GB" : "bn-BD")}
            </span>
          ) : null}
        </div>

        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
        {!result && running ? (
          <p className="mt-2 text-xs text-muted-foreground">{t({ bn: "পরীক্ষা চলছে…", en: "Checking…" })}</p>
        ) : null}

        <ul className="mt-3 space-y-1.5">
          {result?.checks.map((check) => (
            <li
              key={check.name}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs"
            >
              <span className="font-mono">{check.name}</span>
              <span
                className={check.ok ? "text-primary" : "text-destructive"}
              >
                {check.ok ? "✔" : "✖"} {check.detail}
                {check.status ? ` (${check.status})` : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
