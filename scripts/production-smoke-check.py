"""
Post-deployment smoke test: open the live site's key pages (read-only, signed
out) and fail on HTTP 5xx, blank screens, runtime errors or the module-load
recovery fallback. It never signs in, clicks, or writes anything.

Run:  python3 scripts/production-smoke-check.py [base_url]
Default base: https://crm.winstonebd.com      Exit 0 = pass, 1 = fail.
"""
import asyncio
import sys

from playwright.async_api import async_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://crm.winstonebd.com").rstrip("/")
PAGES = ["/", "/auth", "/desk", "/hq", "/projects", "/news", "/live-leads", "/site-visits", "/insights"]
FATAL = ("Importing a module script failed", "dynamically imported module",
         "Failed to fetch dynamically", "Hydration failed", "is not defined")


async def check(browser, path, width, failures):
    ctx = await browser.new_context(viewport={"width": width, "height": 1800})
    page = await ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)[:200]))
    page.on("console", lambda m: m.type == "error" and any(f in m.text for f in FATAL)
            and errors.append(m.text[:200]))
    try:
        resp = await page.goto(BASE + path, wait_until="networkidle", timeout=60_000)
        await page.wait_for_timeout(2000)
        text = (await page.inner_text("body")).strip()
        status = resp.status if resp else 0
    except Exception as e:  # timeout / network
        failures.append(f"{path}@{width}: {str(e)[:160]}")
        await ctx.close()
        return
    blank = len(text) < 20
    fallback = "module" in text.lower() and "refresh" in text.lower() and len(text) < 400
    print(f"{path} @{width}px: http={status} text={len(text)} errors={len(errors)}")
    if status >= 500 or blank or fallback or errors:
        failures.append(f"{path}@{width}: status={status} blank={blank} "
                        f"fallback={fallback} errors={errors[:2]}")
    await ctx.close()


async def main():
    failures = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for path in PAGES:
            for width in (428, 1280):
                await check(browser, path, width, failures)
        await browser.close()
    if failures:
        print("\nFAIL:")
        for f in failures:
            print(" -", f)
        return 1
    print(f"\nPASS: {len(PAGES)} pages x 2 sizes loaded cleanly on {BASE}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
