"""
Regression check: restart the preview dev server, then verify pages and the
public server functions recover without a blank screen.

The check runs signed in (the injected preview session is restored, scoped to
localhost only). Signed out, no page calls a server function at all, so an
unauthenticated run cannot prove server functions came back after a restart.

Sandbox/dev only (kills the local Vite process; the supervisor respawns it).
Never points at the live site. Run:  python3 scripts/restart-recovery-check.py
Exit code 0 = pass, 1 = fail.
"""
import asyncio
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
PAGES = ["/projects", "/", "/desk", "/hq", "/live-leads", "/news", "/site-visits"]
LOG = "/tmp/dev-server-logs/dev-server.log"
BAD_LOG = ("Invalid server function ID", "optimized dependencies changed")

SESSION_KEY = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
SESSION_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
COOKIES_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")


def wait_up(timeout=60):
    end = time.time() + timeout
    while time.time() < end:
        try:
            urllib.request.urlopen(BASE + "/", timeout=5)
            return True
        except Exception:
            time.sleep(1)
    return False


def log_lines():
    try:
        with open(LOG, encoding="utf-8", errors="ignore") as f:
            return f.read().splitlines()
    except FileNotFoundError:
        return []


def _decode(url):
    try:
        seg = url.split("/_serverFn/")[1].split("?")[0]
        seg = seg.replace("-", "+").replace("_", "/")
        return base64.b64decode(seg + "=" * (-len(seg) % 4)).decode("utf-8", "ignore")
    except Exception:
        return ""


async def sign_in(ctx, page):
    """Restore the injected session, scoped to the app's own origin only."""
    if COOKIES_JSON:
        cookies = json.loads(COOKIES_JSON)
        for c in cookies:
            c["url"] = BASE
        await ctx.add_cookies(cookies)
    # Establish the localhost origin first so the storage write lands there.
    await page.goto(BASE + "/", wait_until="domcontentloaded")
    if SESSION_KEY and SESSION_JSON:
        await page.evaluate(
            "([k, v]) => window.localStorage.setItem(k, v)", [SESSION_KEY, SESSION_JSON]
        )


async def check(page, path, failures):
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)[:200]))
    fn = []
    page.on("response", lambda r: "/_serverFn/" in r.url and fn.append((r.status, r.url)))
    resp = await page.goto(BASE + path, wait_until="networkidle", timeout=60_000)
    await page.wait_for_timeout(1500)
    text = (await page.inner_text("body")).strip()
    status = resp.status if resp else 0
    blank = len(text) < 20
    bad_fn = [f"{s} {_decode(u) or u[:80]}" for s, u in fn if s >= 500]
    print(
        f"{path}: http={status} text={len(text)} "
        f"serverFn={[(s, (_decode(u) or '?')[:34]) for s, u in fn]} errors={len(errors)}"
    )
    if status >= 500 or blank or bad_fn or any("dynamically imported" in e for e in errors):
        failures.append(
            f"{path}: status={status} blank={blank} serverFn5xx={bad_fn} errors={errors[:2]}"
        )
    return fn


async def main():
    if not wait_up(10):
        print("dev server not reachable before restart")
        return 1
    if not (SESSION_KEY and SESSION_JSON):
        print("no injected preview session; this check must run signed in")
        return 1

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # Open a tab BEFORE restart, so a stale tab recovering is also tested.
        ctx0 = await browser.new_context(viewport={"width": 1280, "height": 1800})
        seed = await ctx0.new_page()
        await sign_in(ctx0, seed)
        await seed.close()
        stale = await ctx0.new_page()
        await stale.goto(BASE + "/", wait_until="networkidle", timeout=60_000)

        subprocess.run(
            "kill -9 $(ps -ef | grep -E '[v]ite|bun run dev' | awk '{print $2}')", shell=True
        )
        time.sleep(3)
        if not wait_up(90):
            print("FAIL: dev server did not come back")
            return 1
        start = len(log_lines())

        failures = []
        # Stale tab: let its next poll / reload happen, then it must not be blank.
        await stale.wait_for_timeout(4000)
        await stale.reload(wait_until="networkidle")
        if len((await stale.inner_text("body")).strip()) < 20:
            failures.append("stale tab blank after restart")
        await ctx0.close()

        fn_ok = 0
        for vp in ({"width": 1280, "height": 1800}, {"width": 390, "height": 844}):
            ctx = await browser.new_context(viewport=vp)
            seed = await ctx.new_page()
            await sign_in(ctx, seed)
            await seed.close()
            for path in PAGES:
                pg = await ctx.new_page()
                fn = await check(pg, path, failures)
                fn_ok += sum(1 for s, _ in fn if s == 200)
                await pg.close()
            await ctx.close()
        await browser.close()

    # Server functions must come back after a restart. The daily board was
    # removed from the entry hall at the client's request, so its loader is
    # verified on the server instead of through a page that no longer calls it.
    if fn_ok == 0:
        failures.append("no server function returned 200 after restart")
    try:
        tp = urllib.request.urlopen(BASE + "/src/lib/top-performer.server.ts", timeout=15).status
    except urllib.error.HTTPError as exc:
        tp = exc.code
    except Exception as exc:
        tp = f"unreachable ({type(exc).__name__})"
    if tp != 200:
        failures.append(f"top-performer server module http={tp}")

    new_log = log_lines()[start:]
    for needle in BAD_LOG:
        hits = [l for l in new_log if needle in l]
        if hits:
            failures.append(f"dev log after restart contains '{needle}' x{len(hits)}")

    if failures:
        print("FAIL")
        for f in failures:
            print(" -", f)
        return 1
    print("PASS: pages and server functions recovered after restart")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
