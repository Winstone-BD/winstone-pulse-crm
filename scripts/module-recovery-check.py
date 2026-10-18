"""
Regression check: simulate a failed dynamic module import in a running preview
tab and verify (1) the waiting notice appears, (2) concurrent failures coalesce
into one availability probe, (3) the app reloads itself, and (4) after repeated
failed reloads a clear fallback screen with a refresh button shows — never a
blank page. Local dev only; telemetry posts are stubbed so nothing is recorded.
Run: bun run test:recovery   (exit 0 = pass)
"""
import asyncio
import sys
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
FAIL_MSG = "TypeError: Failed to fetch dynamically imported module: /src/x.tsx"


async def main():
    failures = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        await page.route("**/api/public/telemetry/runtime-error", lambda r: r.fulfill(status=204))
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(BASE + "/", wait_until="networkidle", timeout=60_000)
        if errors:
            failures.append(f"fresh boot runtime errors: {errors[:2]}")

        probes = []

        async def head(route):
            if route.request.method == "HEAD":
                probes.append(1)
                await asyncio.sleep(1)
                await route.fulfill(status=200)
            else:
                await route.continue_()

        await page.route(BASE + "/", head)
        loads = []
        page.on("load", lambda: loads.append(1))
        await page.evaluate(
            "m => { for (let i = 0; i < 4; i++) window.dispatchEvent(new ErrorEvent('error', { message: m })); }",
            FAIL_MSG,
        )
        try:
            await page.locator("#deploy-notice").wait_for(timeout=5000)
        except Exception:
            failures.append("waiting notice (#deploy-notice) did not appear")
        await page.wait_for_timeout(4000)
        if len(probes) != 1:
            failures.append(f"expected 1 coalesced probe, got {len(probes)}")
        if not loads:
            failures.append("app did not reload after failed import")
        body = (await page.inner_text("body")).strip()
        if len(body) < 20:
            failures.append("blank page after reload")

        await page.evaluate(
            """m => { sessionStorage.setItem('deployment-reload-attempted','1');
                     sessionStorage.setItem('deployment-reload-attempted:n','3');
                     window.dispatchEvent(new ErrorEvent('error', { message: m })); }""",
            FAIL_MSG,
        )
        try:
            await page.locator("#deploy-recovery").wait_for(timeout=5000)
            if await page.locator("#deploy-recovery button").count() == 0:
                failures.append("fallback screen has no refresh button")
        except Exception:
            failures.append("fallback screen (#deploy-recovery) did not appear")
        await browser.close()

    if failures:
        print("FAIL")
        for f in failures:
            print(" -", f)
        return 1
    print("PASS: notice, coalesced probe, auto reload and fallback screen verified")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
