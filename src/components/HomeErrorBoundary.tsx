import { useEffect, useState } from "react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const KEY = "home-stale-reload-at";
const STALE =
  /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|ChunkLoadError|Invalid hook call|reading 'useState'|reading 'useContext'|Invalid server function ID/i;

/** True when the error looks like old page code left in an open tab. */
export function isStaleCodeError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  return STALE.test(msg);
}

/** Reload at most once per 60s so a real bug never loops. */
export function shouldAutoReload(now: number, last: number | null): boolean {
  return last === null || now - last > 60_000;
}

export function HomeErrorBoundary({ error, reset }: ErrorComponentProps) {
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (!isStaleCodeError(error)) return;
    let last: number | null = null;
    try {
      const v = sessionStorage.getItem(KEY);
      last = v ? Number(v) : null;
    } catch {}
    const now = Date.now();
    if (!shouldAutoReload(now, last)) return;
    try {
      sessionStorage.setItem(KEY, String(now));
    } catch {}
    setReloading(true);
    const t = setTimeout(() => location.reload(), 600);
    return () => clearTimeout(t);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">
          {reloading ? "Loading the latest version…" : "This page didn't load"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {reloading
            ? "The page was updated while it was open. Reloading automatically."
            : "Something went wrong showing the home page. Your data is safe. Try again, or reload the page."}
        </p>
        {!reloading && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={() => reset()}>Try again</Button>
            <Button variant="outline" onClick={() => location.reload()}>
              Reload page
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
