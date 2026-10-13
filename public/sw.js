/**
 * Winstone Pulse offline shell.
 *
 * Small and honest: navigations and static assets are served from a runtime
 * cache when the network is unavailable, so an agent can still open the CRM,
 * see the lead data that was already loaded and write a report. Nothing here
 * pretends a write reached the server — writes go through the local queue in
 * src/lib/offline-queue.ts and only sync when the network is back.
 */
const CACHE = "winstone-shell-v4";

// Editor/preview hosts restart often; an offline shell there only strands the
// tab on a fallback page. Remove this worker from those hosts entirely.
const PREVIEW_HOST =
  /^(id-preview--|preview--)/.test(self.location.hostname) ||
  /(^|\.)lovableproject(-dev)?\.com$/.test(self.location.hostname) ||
  /(^|\.)beta\.lovable\.dev$/.test(self.location.hostname) ||
  self.location.hostname === "localhost";

// Shown only when the page itself could not be fetched and nothing is cached.
// It retries on its own, so a short server restart never strands the tab.
const RETRY_PAGE = `<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Winstone Pulse</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#fafafa;color:#111;text-align:center;padding:24px}button{margin-top:16px;padding:10px 20px;border-radius:8px;border:1px solid #111;background:#111;color:#fff;font-size:15px}</style></head>
<body><div><p id="m">সংযোগ হচ্ছে… / Connecting…</p><button onclick="location.reload()">আবার চেষ্টা / Retry</button></div>
<script>
var m=document.getElementById("m");
if(!navigator.onLine){m.textContent="অফলাইন — ইন্টারনেট ফিরলে নিজে থেকেই খুলবে / Offline — will reopen when internet returns";}
window.addEventListener("online",function(){location.reload();});
var n=0;(function t(){n++;fetch(location.href,{cache:"no-store"}).then(function(r){if(r.ok)location.reload();else setTimeout(t,Math.min(15000,2000*n));}).catch(function(){setTimeout(t,Math.min(15000,2000*n));});})();
</script></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  if (PREVIEW_HOST) {
    event.waitUntil(
      (async () => {
        try {
          const keys = await caches.keys();
          await Promise.allSettled(keys.filter((k) => k.startsWith("winstone-shell-")).map((k) => caches.delete(k)));
          await self.clients.claim();
          const clients = await self.clients.matchAll({ type: "window" });
          await Promise.allSettled(clients.map((c) => c.navigate(c.url)));
        } finally {
          await self.registration.unregister();
        }
      })(),
    );
    return;
  }
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (PREVIEW_HOST || request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API traffic — stale CRM data must not look live.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_serverFn")) return;
  // Vite development modules are revision-coupled. Caching them can combine an
  // old React runtime with a newer router module and crash every hook call.
  if (
    url.pathname.startsWith("/src/") ||
    url.pathname.startsWith("/node_modules/") ||
    url.pathname.startsWith("/@vite/") ||
    url.pathname.startsWith("/@react-refresh")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((hit) => hit ?? caches.match("/"))
            .then(
              (hit) =>
                hit ??
                new Response(RETRY_PAGE, {
                  status: 503,
                  headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
                }),
            ),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(request, copy));
          } else if (response.status === 404 && url.pathname.startsWith("/assets/")) {
            // A page from an older deployment asked for a file that no longer
            // exists. Drop the cached pages so the recovery reload gets the
            // current deployment instead of the stale offline copy.
            void caches.open(CACHE).then(async (cache) => {
              for (const key of await cache.keys()) {
                if (!new URL(key.url).pathname.startsWith("/assets/")) await cache.delete(key);
              }
            });
          }
          return response;
        }),
    ),
  );
});
