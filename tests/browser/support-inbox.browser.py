"""Makes a support inbox server-function request fail and checks the recovery
message, Try again, and Reload page actions. Run: bun run test:inbox-browser"""
import asyncio, subprocess, sys
from playwright.async_api import async_playwright

subprocess.run(
    [
        "bun", "build", "tests/browser/support-inbox.entry.tsx",
        "--outfile=/tmp/support-inbox.js",
        "--tsconfig-override", "tests/browser/tsconfig.support-inbox.json",
        "--define", "process.env.NODE_ENV='\"production\"'",
    ],
    check=True, capture_output=True,
)
JS = open("/tmp/support-inbox.js").read()
ORIGIN = "http://inbox.test"
PAGE = (
    "<!doctype html><html><body><div id=root></div>"
    "<script>window.__fail=sessionStorage.getItem('fixed')!=='1';</script>"
    "<script type=module src=/app.js></script></body></html>"
)
fails = []


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context()
        docs = {"n": 0}

        async def h(r):
            if r.request.url.endswith("/app.js"):
                return await r.fulfill(status=200, content_type="text/javascript", body=JS)
            docs["n"] += 1
            await r.fulfill(status=200, content_type="text/html", body=PAGE)

        await ctx.route(ORIGIN + "/**", h)
        page = await ctx.new_page()
        page.on("pageerror", lambda e: print("PAGEERR", e))

        # Failed request shows the recovery message, not a blank screen.
        await page.goto(ORIGIN + "/")
        await page.get_by_role("heading", name="Support inbox couldn't load").wait_for(timeout=5000)
        check(True, "failed request shows recovery message instead of blanking the page")
        check(
            await page.get_by_text("Your tickets are safe").is_visible(),
            "message reassures tickets are safe",
        )

        # Try again while the request still fails shows the message again.
        await page.get_by_role("button", name="Try again").click()
        await page.wait_for_timeout(500)
        check(
            await page.get_by_role("heading", name="Support inbox couldn't load").is_visible(),
            "Try again retries; still-failing request shows message again",
        )

        # Try again recovers once the request succeeds.
        await page.evaluate("window.__fail=false")
        await page.get_by_role("button", name="Try again").click()
        await page.get_by_text("টিম সাপোর্ট ইনবক্স").wait_for(timeout=5000)
        check(True, "Try again recovers and shows the inbox once the request succeeds")

        # Reload page performs exactly one full reload and loads the inbox.
        await page.evaluate("window.__fail=true; sessionStorage.setItem('fixed','1')")
        await page.reload()
        await page.get_by_role("button", name="Reload page").wait_for(timeout=5000)
        before = docs["n"]
        await page.get_by_role("button", name="Reload page").click()
        await page.get_by_text("টিম সাপোর্ট ইনবক্স").wait_for(timeout=5000)
        check(
            docs["n"] == before + 1,
            "Reload page performs exactly one full reload and loads the inbox",
        )

        await b.close()
    if fails:
        sys.exit(1)
    print("\nall support inbox recovery checks passed")


asyncio.run(main())
