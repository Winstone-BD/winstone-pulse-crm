"""
Regression check: restart the preview dev server, then verify pages and the
public top-performer server function recover without a blank screen.

Sandbox/dev only (kills the local Vite process; the supervisor respawns it).
Never points at the live site. Run:  python3 scripts/restart-recovery-check.py
Exit code 0 = pass, 1 = fail.
"""
import asyncio
import subprocess
import sys
import time
import urllib.request

from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
PAGES = ["/", "/desk", "/hq", "/live-leads", "/news", "/site-visits"]
LOG = "/tmp/dev-server-logs/dev-server.log"
BAD_LOG = ("Invalid server function ID", "optimized dependencies changed")


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
    bad_fn = [s for s in fn if s[0] >= 500]
    print(f"{path}: http={status} text={len(text)} serverFn={[s for s, _ in fn]} errors={len(errors)}")
    if status >= 500 or blank or bad_fn or any("dynamically imported" in e for e in errors):
        failures.append(f"{path}: status={status} blank={blank} serverFn5xx={bad_fn} errors={errors[:2]}")
    return fn


async def main():
    if not wait_up(10):
        print("dev server not reachable before restart")
        return 1
    # Open a tab BEFORE restart, so we also test a stale tab recovering.
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        stale = await browser.new_page(viewport={"width": 1280, "height": 1800})
        await stale.goto(BASE + "/", wait_until="networkidle", timeout=60_000)

        subprocess.run("kill -9 $(ps -ef | grep -E '[v]ite|bun run dev' | awk '{print $2}')", shell=True)
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

        top_fn_seen = False
        for vp in ({"width": 1280, "height": 1800}, {"width": 390, "height": 844}):
            ctx = await browser.new_context(viewport=vp)
            for path in PAGES:
                pg = await ctx.new_page()
                fn = await check(pg, path, failures)
                top_fn_seen |= any("top-performer" in _decode(u) and s == 200 for s, u in fn)
                await pg.close()
            await ctx.close()
        await browser.close()

    if not top_fn_seen:
        failures.append("top-performer server function never returned 200 on /")
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
    print("PASS: pages and top-performer recovered after restart")
    return 0


def _decode(url):
    import base64
    try:
        seg = url.split("/_serverFn/")[1].split("?")[0]
        seg = seg.replace("-", "+").replace("_", "/")
        return base64.b64decode(seg + "=" * (-len(seg) % 4)).decode("utf-8", "ignore")
    except Exception:
        return ""


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
