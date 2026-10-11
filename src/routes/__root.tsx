import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { MustChangePasswordGate } from "@/components/crm/MustChangePasswordGate";
import { FloorLockGate } from "@/components/crm/FloorLockGate";
import { MaintenanceGate } from "@/components/crm/MaintenanceNotice";
import { TemporaryClosureNotice } from "@/components/crm/TemporaryClosureNotice";
import { supabase } from "@/integrations/supabase/client";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const appError = error instanceof Error ? error : new Error(String(error));
  console.error(appError);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(appError, { boundary: "tanstack_root_error_component" });
  }, [appError]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "google-site-verification", content: "pUD5ufdP9fb3xS36_ge0Nh6wa0gj1bYVww3jofy2f10" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      },
      { title: "Winstone CRM & Sales Operating System" },
      {
        name: "description",
        content: "উইনস্টোন টিমের কল, লিড ও রিপোর্ট — ফোনের হোম স্ক্রিন থেকেই চলবে।",
      },
      { property: "og:title", content: "Winstone CRM & Sales Operating System" },
      {
        property: "og:description",
        content: "উইনস্টোন টিমের কল, লিড ও রিপোর্ট — ফোনের হোম স্ক্রিন থেকেই চলবে।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      // Home-screen install (manifest-only; no offline caching).
      { name: "theme-color", content: "#0f0e0c" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Winstone" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/icons/favicon-32.png" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const developmentCacheReset = import.meta.env.DEV
    ? `
      (() => {
        if (!("serviceWorker" in navigator) || sessionStorage.getItem("winstone-dev-cache-reset-v2")) return;
        sessionStorage.setItem("winstone-dev-cache-reset-v2", "1");
        Promise.all([
          navigator.serviceWorker.getRegistrations().then((items) => Promise.all(items.map((item) => item.unregister()))),
          "caches" in window
            ? caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("winstone-shell-")).map((key) => caches.delete(key))))
            : Promise.resolve(),
        ]).then(() => {
          if (navigator.serviceWorker.controller) window.location.reload();
        });
      })();
    `
    : "";

  return (
    <html lang="bn">
      <head>
        <HeadContent />
        {/* Recover from stale/failed script downloads after a new deployment:
            exactly one automatic reload per tab, then a friendly fallback screen
            with a manual Refresh button. The flag clears once the app boots. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var K="deployment-reload-attempted";function attempted(){try{return sessionStorage.getItem(K)==="1"}catch(e){return false}}function mark(){try{sessionStorage.setItem(K,"1")}catch(e){}}function fallback(){if(document.getElementById("deploy-recovery"))return;var d=document.createElement("div");d.id="deploy-recovery";d.style.cssText="position:fixed;inset:0;z-index:99999;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-family:system-ui,sans-serif;text-align:center;padding:24px";var h=document.createElement("div");h.style.cssText="font-size:20px;font-weight:700;color:#1c1917";h.textContent="নতুন version পাওয়া গেছে";var p=document.createElement("div");p.style.cssText="font-size:14px;color:#57534e;max-width:320px";p.textContent="এই পেজটি নতুন deployment-এর সাথে আপডেট হচ্ছে। অনুগ্রহ করে পেজটি রিফ্রেশ করুন।";var b=document.createElement("button");b.style.cssText="margin-top:8px;padding:10px 24px;font-size:15px;font-weight:600;color:#fff;background:#1c1917;border:none;border-radius:8px;cursor:pointer";b.textContent="Refresh Page";b.onclick=function(){try{sessionStorage.removeItem(K)}catch(e){}location.reload()};d.appendChild(h);d.appendChild(p);d.appendChild(b);(document.body||document.documentElement).appendChild(d)}var SENT=0;function send(kind,msg){if(SENT>=10)return;SENT++;try{var b=JSON.stringify({kind:String(kind).slice(0,60),message:String(msg||kind).slice(0,1500),route:location.pathname});if(navigator.sendBeacon){navigator.sendBeacon("/api/public/telemetry/runtime-error",new Blob([b],{type:"application/json"}))}else{fetch("/api/public/telemetry/runtime-error",{method:"POST",body:b,headers:{"content-type":"application/json"},keepalive:true})}}catch(x){}}window.__winstoneReportError=send;function log(kind,detail){var e={at:new Date().toISOString(),kind:kind,detail:String(detail||"").slice(0,300),page:location.pathname,reloaded:attempted()};try{var L=JSON.parse(localStorage.getItem("winstone-reload-log")||"[]");L.push(e);localStorage.setItem("winstone-reload-log",JSON.stringify(L.slice(-20)))}catch(x){}var ok=kind==="recovered-after-reload";try{(ok?console.info:console.error)("[winstone-recovery]",JSON.stringify(e))}catch(x){}if(!ok)send(kind,e.detail||kind);if(!ok)try{window.__lovableReportRuntimeError&&window.__lovableReportRuntimeError({message:"Module load recovery: "+kind+" — "+e.detail,filename:location.pathname})}catch(x){}}function n(){try{return +(sessionStorage.getItem(K+":n")||0)}catch(e){return 0}}function waitThenReload(){var t=0;(function ping(){fetch(location.pathname,{method:"HEAD",cache:"no-store"}).then(function(x){if(x.ok)location.reload();else again()},again)})();function again(){if(++t>15){fallback();return}setTimeout(function(){fetch(location.pathname,{method:"HEAD",cache:"no-store"}).then(function(x){if(x.ok)location.reload();else again()},again)},2000)}}function r(kind,detail){log(kind,detail);var c=n();if(attempted()&&c>=3){log("fallback-shown",detail);fallback();return}mark();try{sessionStorage.setItem(K+":n",String(c+1))}catch(e){}if(/default-entry/.test(String(detail||""))){log("entry-reload",String(detail||"").slice(0,160));setTimeout(function(){location.reload()},1500);return}waitThenReload()}function bad(m){return /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|ChunkLoadError/i.test(String(m||""))}var F=window.fetch;if(F){window.fetch=function(){var a=arguments;return F.apply(this,a).then(function(res){try{var u=String(a[0]&&a[0].url||a[0]);if(res.status===500&&u.indexOf("/_serverFn/")>=0){res.clone().text().then(function(t){if(/Invalid server function ID/i.test(t))r("stale-server-fn",u.split("?")[0].slice(-80))}).catch(function(){})}}catch(x){}return res})}}window.addEventListener("vite:preloadError",function(e){e.preventDefault();r("preload-error",e.payload&&e.payload.message)});window.addEventListener("error",function(e){var t=e.target;if(t&&t.tagName==="SCRIPT"&&t.type==="module"){r("script-load-failed",t.src);return}if(bad(e.message))r("module-error",e.message)},true);window.addEventListener("unhandledrejection",function(e){var m=e.reason&&e.reason.message||e.reason;if(bad(m)){r("import-rejected",m);return}send("unhandled-rejection",m)});window.addEventListener("error",function(e){if(e.target&&e.target!==window)return;if(bad(e.message))return;if(!e.message||/ResizeObserver loop/.test(e.message))return;send("runtime-error",e.message+(e.filename?" @ "+String(e.filename).split("?")[0]+":"+e.lineno:""))});window.__clearDeployReloadFlag=function(){if(attempted())log("recovered-after-reload","");try{sessionStorage.removeItem(K);sessionStorage.removeItem(K+":n")}catch(e){}}})();`,
          }}
        />
      </head>
      <body>
        {developmentCacheReset ? (
          <script dangerouslySetInnerHTML={{ __html: developmentCacheReset }} />
        ) : null}
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // The app booted — clear the one-time deployment reload flag so the next
  // deployment can recover normally again.
  useEffect(() => {
    (window as unknown as { __clearDeployReloadFlag?: () => void }).__clearDeployReloadFlag?.();
  }, []);

  // One place that reacts to sign-in / sign-out so every board refetches with
  // the new identity.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient, router]);

  // Offline shell: lets an installed CRM open and keep working without internet.
  // Writes still go through the local queue and only sync when the network is back.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // A service worker must never cache Vite's development module graph. Mixing
    // modules from two HMR revisions can load two incompatible React runtimes.
    if (import.meta.env.DEV) {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      );
      if (typeof caches !== "undefined") {
        void caches.keys().then((keys) =>
          Promise.all(keys.filter((key) => key.startsWith("winstone-shell-")).map((key) => caches.delete(key))),
        );
      }
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
      /* offline shell unavailable — the app still works online */
    });
  }, []);


  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      {/* The floor notice must cover every signed-in route, including the home page. */}
      <MustChangePasswordGate />
      <FloorLockGate />
      {/* Monthly maintenance banner / lock screen — the server enforces the lock itself. */}
      <MaintenanceGate />
      {/* Temporary IT closure covers home, agent, coordinator, HQ and IT surfaces. */}
      <TemporaryClosureNotice />
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}
