"""
Regression check for /hq: make the HQ page's own module fail to load (as after a
preview restart), then let it serve again and confirm the tab recovers by itself
into the real HQ screen — no blank page, no fallback screen.
Local dev only; telemetry posts are stubbed so nothing is recorded.
Run: python3 scripts/route-module-recovery-check.py [--route desk] [--mobile]
"""
import asyncio
import sys
import re
import time
from playwright.async_api import async_playwright

import argparse
ap = argparse.ArgumentParser()
ap.add_argument("--route", default="hq", help="route file name, e.g. hq, desk, insights")
ap.add_argument("--mobile", action="store_true", help="use a 390x844 phone viewport")
ARGS = ap.parse_args()
BASE = "http://localhost:8080"
ROUTE = ARGS.route.strip("/")
VIEWPORT = {"width": 390, "height": 844} if ARGS.mobile else {"width": 1280, "height": 1800}
BLOCK_SECONDS = 6


async def main():
    failures = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport=VIEWPORT, is_mobile=ARGS.mobile, has_touch=ARGS.mobile)
        page = await ctx.new_page()
        await page.route("**/api/public/telemetry/runtime-error", lambda r: r.fulfill(status=204))

        blocked = {"n": 0, "until": None}

        async def hq_module(route):
            if blocked["until"] and time.time() < blocked["until"]:
                blocked["n"] += 1
                await route.abort("connectionrefused")
            else:
                await route.continue_()

        # Only the HQ route module (not the document) is cut off.
        await page.route(re.compile(r"/src/routes/" + re.escape(ROUTE) + r"\.tsx"), hq_module)
        loads = []
        page.on("load", lambda: loads.append(1))

        blocked["until"] = time.time() + BLOCK_SECONDS
        await page.goto(BASE + "/" + ROUTE, wait_until="domcontentloaded", timeout=60_000)

        # Wait for recovery: notice/probing, then a reload once the module serves.
        deadline = time.time() + 45
        recovered = False
        while time.time() < deadline:
            await page.wait_for_timeout(1000)
            if await page.locator("#deploy-recovery").count():
                failures.append("fallback screen shown instead of recovering")
                break
            if time.time() > blocked["until"] and len(loads) >= 2:
                try:
                    await page.wait_for_load_state("networkidle", timeout=15_000)
                except Exception:
                    pass
                body = (await page.inner_text("body")).strip()
                if len(body) >= 20 and not await page.locator("#deploy-notice").count():
                    recovered = True
                    break

        if blocked["n"] == 0:
            failures.append(f"/{ROUTE} module was never requested while blocked (simulation did not trigger)")
        if not recovered and not failures:
            failures.append("page did not recover into page content within 45s")
        if recovered and len((await page.inner_text("body")).strip()) < 20:
            failures.append("blank page after recovery")
        await page.screenshot(path=f"/tmp/{ROUTE}-recovery{'-mobile' if ARGS.mobile else ''}.png")
        await browser.close()

    if failures:
        print("FAIL")
        for f in failures:
            print(" -", f)
        return 1
    print(f"PASS [{VIEWPORT['width']}px]: /{ROUTE} module blocked {blocked['n']}x, tab reloaded and the page rendered (no blank, no fallback)")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
