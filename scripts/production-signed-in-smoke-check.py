"""
Post-deployment smoke test for signed-in pages: restores an existing staff
session, opens key authenticated pages (read-only — no clicks, no writes) and
fails on HTTP 5xx, blank screens, runtime errors, the module-load fallback, or
being bounced to the sign-in page.

Session (never created here, never printed), first usable wins:
  ~/.cache/lovable-auth/session.json  (from `lovable auth-session --json`)
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON + LOVABLE_BROWSER_SUPABASE_STORAGE_KEY
No usable session -> exit 2 (skipped), not a failure.

Run:  python3 scripts/production-signed-in-smoke-check.py [base_url]
Default base: https://crm.winstonebd.com   Exit 0 pass, 1 fail, 2 skipped.
"""
import asyncio
import json
import os
import sys
import time

from playwright.async_api import async_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://crm.winstonebd.com").rstrip("/")
PAGES = ["/desk", "/insights", "/live-leads", "/site-visits", "/projects", "/news", "/reports", "/customers"]
FATAL = ("Importing a module script failed", "dynamically imported module",
         "Failed to fetch dynamically", "Hydration failed", "is not defined")


def load_session():
    f = os.path.expanduser("~/.cache/lovable-auth/session.json")
    if os.path.exists(f):
        try:
            m = json.load(open(f))
            if m.get("session", {}).get("expires_at", 0) > time.time() + 60:
                return m["storage_key"], m["session"], m.get("cookies") or []
        except Exception:
            pass
    sj, key = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON"), os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    if sj and key:
        s = json.loads(sj)
        if s.get("expires_at", 0) > time.time() + 60:
            cj = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
            return key, s, json.loads(cj) if cj else []
    return None


async def main():
    sess = load_session()
    if not sess:
        print("SKIP: no unexpired staff session (run `lovable auth-session --json` first)")
        return 2
    key, session, cookies = sess
    failures = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for width in (428, 1280):
            ctx = await browser.new_context(viewport={"width": width, "height": 1800})
            if cookies:
                await ctx.add_cookies([{**c, "url": BASE} for c in cookies])
            page = await ctx.new_page()
            await page.goto(BASE + "/auth", wait_until="domcontentloaded", timeout=60_000)
            # Origin-scoped write only (no init script on other origins).
            await page.evaluate("([k, v]) => localStorage.setItem(k, v)", [key, json.dumps(session)])
            for path in PAGES:
                errors = []
                h1 = lambda e: errors.append(str(e)[:200])
                h2 = lambda m: m.type == "error" and any(f in m.text for f in FATAL) and errors.append(m.text[:200])
                page.on("pageerror", h1); page.on("console", h2)
                try:
                    resp = await page.goto(BASE + path, wait_until="networkidle", timeout=60_000)
                    await page.wait_for_timeout(2500)
                    text = (await page.inner_text("body")).strip()
                    status = resp.status if resp else 0
                    url = page.url
                except Exception as e:
                    failures.append(f"{path}@{width}: {str(e)[:160]}")
                    continue
                finally:
                    page.remove_listener("pageerror", h1); page.remove_listener("console", h2)
                blank = len(text) < 20
                bounced = "/auth" in url
                fallback = await page.locator("#deploy-recovery").count() > 0
                print(f"{path} @{width}px: http={status} text={len(text)} errors={len(errors)} signed_in={not bounced}")
                if status >= 500 or blank or bounced or fallback or errors:
                    failures.append(f"{path}@{width}: status={status} blank={blank} bounced_to_signin={bounced} "
                                    f"fallback={fallback} errors={errors[:2]}")
            await ctx.close()
        await browser.close()
    if failures:
        print("\nFAIL:")
        for f in failures:
            print(" -", f)
        return 1
    print(f"\nPASS: {len(PAGES)} signed-in pages x 2 sizes loaded cleanly on {BASE}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
