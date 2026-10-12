import { Download, Share, Smartphone, Globe } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/lib/i18n";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Device = "android" | "ios" | "mac" | "desktop";

const APK_URL = "/api/public/download/apk";

function detectDevice(): Device {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  // iPadOS reports as Mac — touch points tell them apart.
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Macintosh/.test(ua)) return "mac";
  return "desktop";
}

/**
 * Device-aware install: Android users may pick the Android app OR the Chrome
 * web app; iPhone/iPad get Safari "Add to Home Screen" steps; desktop/Mac get
 * the browser install prompt.
 */
export function InstallAppButton() {
  const t = useT();
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [standalone, setStandalone] = useState(true);
  const [device, setDevice] = useState<Device>("desktop");

  useEffect(() => {
    setDevice(detectDevice());
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setStandalone(installed);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => setStandalone(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone) return null;

  const installWeb = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          aria-label={t({ bn: "অ্যাপ ইনস্টল করুন", en: "Install app" })}
          className="h-8 w-8 shrink-0 gap-1.5 whitespace-nowrap rounded-full px-0 text-xs font-semibold sm:w-auto sm:px-3"
        >
          <Download className="size-3.5" />
          <span className="hidden sm:inline">{t({ bn: "অ্যাপ ইনস্টল", en: "Install app" })}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 text-sm">
        <p className="font-semibold">{t({ bn: "অ্যাপ হিসেবে ব্যবহার করুন", en: "Use it as an app" })}</p>

        {device === "android" ? (
          <>
            <a
              href={APK_URL}
              download="winstone-pulse.apk"
              className="flex items-center gap-2 rounded-md border p-3 hover:bg-muted"
            >
              <Smartphone className="size-4 shrink-0 text-primary" />
              <span>
                <span className="block font-medium">{t({ bn: "Android অ্যাপ (সুপারিশকৃত)", en: "Android app (recommended)" })}</span>
                <span className="text-xs text-muted-foreground">{t({ bn: "নিজের সিমে কল ও রেকর্ডিং", en: "Calls & recording on your own SIM" })}</span>
              </span>
            </a>
            <WebOption prompt={!!prompt} onInstall={installWeb} hint={t({ bn: "Chrome মেনু (⋮) → “Add to Home screen”", en: "Chrome menu (⋮) → “Add to Home screen”" })} />
          </>
        ) : device === "ios" ? (
          <div className="space-y-1 rounded-md border p-3">
            <p className="flex items-center gap-2 font-medium">
              <Share className="size-4 text-primary" /> iPhone / iPad
            </p>
            <p className="text-xs text-muted-foreground">
              {t({ bn: "Safari-তে নিচের Share বোতাম → “Add to Home Screen” → Add", en: "In Safari, tap the Share button below → “Add to Home Screen” → Add" })}
            </p>
          </div>
        ) : (
          <WebOption
            prompt={!!prompt}
            onInstall={installWeb}
            hint={
              device === "mac"
                ? t({ bn: "Chrome: ঠিকানা-বারের ইনস্টল আইকন • Safari: File → Add to Dock", en: "Chrome: install icon in the address bar • Safari: File → Add to Dock" })
                : t({ bn: "Chrome/Edge: ঠিকানা-বারের ইনস্টল আইকন চাপুন", en: "Chrome/Edge: tap the install icon in the address bar" })
            }
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function WebOption({ prompt, onInstall, hint }: { prompt: boolean; onInstall: () => void; hint: string }) {
  const t = useT();
  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="flex items-center gap-2 font-medium">
        <Globe className="size-4 text-primary" /> {t({ bn: "ওয়েব অ্যাপ", en: "Web app" })}
      </p>
      {prompt ? (
        <Button size="sm" className="w-full" onClick={onInstall}>
          {t({ bn: "এখনই ইনস্টল করুন", en: "Install now" })}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
