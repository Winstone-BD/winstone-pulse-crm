"""
Browser test for src/lib/deploy-recovery.ts (stale page code recovery).

Runs the real recovery script in Chromium against a fake origin served by
Playwright routing (no dev server, no backend). It simulates an open tab whose
module chunk vanished after an update, and checks that the page:
  1. shows the "Loading the new version" notice,
  2. does NOT reload while the new module is still missing (document already up),
  3. reloads once the module serves again,
  4. shows the "New version available" fallback when the module never returns.

Run: bun run test:recovery-browser
"""
import asyncio, subprocess, sys
from playwright.async_api import async_playwright

ORIGIN = "http://recovery.test"
SCRIPT = subprocess.run(
    ["bun", "-e", "import {deployRecoveryScript as s} from './src/lib/deploy-recovery.ts'; process.stdout.write(s)"],
    capture_output=True, text=True, check=True,
).stdout

PAGE = f"""<!doctype html><html><head><script>{SCRIPT}</script></head>
<body><div id=app>old</div>
<script type=module>
import("/assets/chunk.js").then(function(){{document.getElementById("app").textContent="new";window.__clearDeployReloadFlag()}});
</script></body></html>"""

failures = []
def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond: failures.append(msg)

async def scenario(browser, module_ready_after_probes, probe_tries_override=None):
    ctx = await browser.new_context()
    page = await ctx.new_page()
    state = {"docs": 0, "probes": 0, "ready": False}

    async def handle(route):
        req = route.request
        url = req.url
        if url.startswith(ORIGIN + "/assets/chunk.js"):
            if req.method == "HEAD":
                state["probes"] += 1
                if module_ready_after_probes is not None and state["probes"] >= module_ready_after_probes:
                    state["ready"] = True
            if state["ready"]:
                return await route.fulfill(status=200, content_type="text/javascript", body="export default 1;")
            return await route.fulfill(status=404, content_type="text/html", body="missing")
        if req.method == "GET": state["docs"] += 1
        await route.fulfill(status=200, content_type="text/html", body=PAGE)

    await ctx.route(ORIGIN + "/**", handle)
    html = PAGE if probe_tries_override is None else PAGE.replace("PROBE_TRIES=12", f"PROBE_TRIES={probe_tries_override}")
    if probe_tries_override is not None:
        async def handle2(route):
            if route.request.url.startswith(ORIGIN + "/assets/"): return await handle(route)
            if route.request.method == "GET": state["docs"] += 1
            await route.fulfill(status=200, content_type="text/html", body=html)
        await ctx.unroute(ORIGIN + "/**"); await ctx.route(ORIGIN + "/**", handle2)
    await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
    return ctx, page, state

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # A: module comes back on the 3rd probe -> reload only then -> new code runs.
        ctx, page, st = await scenario(browser, module_ready_after_probes=3)
        await page.wait_for_selector("#deploy-notice", timeout=5000)
        check(True, "stale chunk shows 'Loading the new version' notice")
        await page.wait_for_timeout(2500)
        check(st["docs"] == 1 and st["probes"] < 3, f"no reload while module still missing (docs={st['docs']}, probes={st['probes']})")
        await page.wait_for_function("document.getElementById('app').textContent==='new'", timeout=15000)
        check(st["docs"] == 2, f"exactly one reload, after module served (docs={st['docs']})")
        check(await page.locator("#deploy-notice").count() == 0, "notice cleared after recovery")
        check(await page.evaluate("sessionStorage.getItem('deployment-reload-attempted')") is None, "reload flag cleared")
        await ctx.close()

        # B: module never returns -> no reload, fallback screen shown.
        ctx, page, st = await scenario(browser, module_ready_after_probes=None, probe_tries_override=2)
        await page.wait_for_selector("#deploy-recovery", timeout=10000)
        check(st["docs"] == 1, f"never reloads into a still-broken server (docs={st['docs']})")
        check(await page.get_by_role("button", name="Refresh Page").is_visible(), "fallback offers Refresh Page")
        await ctx.close()

        # C: four reloads already used -> stop, show refresh screen, no reload loop.
        ctx = await browser.new_context()
        await ctx.add_init_script("if(location.origin==='http://recovery.test'){sessionStorage.setItem('deployment-reload-attempted','1');sessionStorage.setItem('deployment-reload-attempted:n','4')}")
        st = {"docs": 0, "probes": 0}
        async def handle3(route):
            r = route.request
            if r.url.startswith(ORIGIN + "/assets/"):
                if r.method == "HEAD": st["probes"] += 1
                return await route.fulfill(status=404, content_type="text/html", body="missing")
            if r.method == "GET": st["docs"] += 1
            await route.fulfill(status=200, content_type="text/html", body=PAGE)
        await ctx.route(ORIGIN + "/**", handle3)
        page = await ctx.new_page()
        await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
        await page.wait_for_selector("#deploy-recovery", timeout=5000)
        check(await page.get_by_role("button", name="Refresh Page").is_visible(), "after 4 failed attempts the refresh screen shows")
        await page.wait_for_timeout(6000)
        check(st["docs"] == 1, f"no reload loop after limit (docs={st['docs']})")
        check(st["probes"] == 0, f"stops probing after limit (probes={st['probes']})")
        check(await page.locator("#deploy-notice").count() == 0, "no 'loading' notice once limit reached")
        await ctx.close()

        # D: interrupted reload — the reload starts but is aborted mid-flight, server then flaps.
        # The page must end on a usable refresh screen, and Refresh Page must load the new version.
        ctx = await browser.new_context()
        st = {"docs": 0, "ready": False, "abort_next_doc": False}
        html = PAGE.replace("PROBE_TRIES=12", "PROBE_TRIES=2")
        async def handle4(route):
            r = route.request
            if r.url.startswith(ORIGIN + "/assets/"):
                if st["ready"]: return await route.fulfill(status=200, content_type="text/javascript", body="export default 1;")
                return await route.fulfill(status=404, content_type="text/html", body="missing")
            if r.method == "GET":
                if st["abort_next_doc"]:
                    st["abort_next_doc"] = False
                    return await route.abort("connectionreset")
                st["docs"] += 1
            await route.fulfill(status=200, content_type="text/html", body=html)
        await ctx.route(ORIGIN + "/**", handle4)
        page = await ctx.new_page()
        await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
        await page.wait_for_selector("#deploy-recovery", timeout=15000)
        st["abort_next_doc"] = True
        try:
            await page.get_by_role("button", name="Refresh Page").click()
            await page.wait_for_timeout(1500)
        except Exception: pass
        check(st["docs"] == 1, f"interrupted reload did not load a new document (docs={st['docs']})")
        await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
        await page.wait_for_selector("#deploy-recovery", timeout=15000)
        btn = page.get_by_role("button", name="Refresh Page")
        check(await btn.is_visible() and await btn.is_enabled(), "refresh screen is shown again and usable after the interruption")
        st["ready"] = True
        await btn.click()
        await page.wait_for_function("document.getElementById('app').textContent==='new'", timeout=15000)
        check(await page.locator("#deploy-recovery").count() == 0, "Refresh Page loads the new version and clears the screen")
        check(await page.evaluate("sessionStorage.getItem('deployment-reload-attempted:n')") is None, "reload counter cleared after recovery")
        await ctx.close()

        await browser.close()
    if failures:
        print(f"\n{len(failures)} failure(s)"); sys.exit(1)
    print("\nall recovery browser checks passed")

asyncio.run(main())
