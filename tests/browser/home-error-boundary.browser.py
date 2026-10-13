"""Forces the homepage to fail rendering and checks the recovery screen.
Run: bun run test:home-boundary-browser"""
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
subprocess.run(["bun","build","tests/browser/home-error-boundary.entry.tsx","--outfile=/tmp/home-boundary.js","--define","process.env.NODE_ENV='\"production\"'"],check=True,capture_output=True)
JS=open("/tmp/home-boundary.js").read()
ORIGIN="http://boundary.test"
PAGE=f"<!doctype html><html><body><div id=root></div><script>window.__fail=sessionStorage.getItem('fixed')!=='1';</script><script type=module src=/app.js></script></body></html>"
fails=[]
def check(ok,msg):
    print(("PASS " if ok else "FAIL ")+msg)
    if not ok: fails.append(msg)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(headless=True); ctx=await b.new_context(); docs={"n":0}
        async def h(r):
            if r.request.url.endswith("/app.js"): return await r.fulfill(status=200,content_type="text/javascript",body=JS)
            docs["n"]+=1; await r.fulfill(status=200,content_type="text/html",body=PAGE)
        await ctx.route(ORIGIN+"/**",h); page=await ctx.new_page(); page.on("pageerror",lambda e: print("PAGEERR",e)); page.on("console",lambda m: print("CON",m.text[:200]))
        await page.goto(ORIGIN+"/")
        await page.get_by_role("heading",name="This page didn't load").wait_for(timeout=5000)
        check(True,"forced failure shows recovery message instead of white screen")
        check(await page.get_by_text("Your data is safe").is_visible(),"message reassures data is safe")
        await page.get_by_role("button",name="Try again").click()
        check(await page.get_by_role("heading",name="This page didn't load").is_visible(),"Try again re-renders; still-broken page shows message again")
        await page.evaluate("window.__fail=false")
        await page.get_by_role("button",name="Try again").click()
        check(await page.get_by_role("heading",name="Home loaded").is_visible(),"Try again recovers once the fault is gone")
        await page.evaluate("window.__fail=true"); await page.reload()
        await page.get_by_role("button",name="Reload page").wait_for()
        before=docs["n"]; await page.evaluate("sessionStorage.setItem('fixed','1')")
        await page.get_by_role("button",name="Reload page").click()
        await page.get_by_role("heading",name="Home loaded").wait_for(timeout=5000)
        check(docs["n"]==before+1,"Reload page performs exactly one full reload and loads the page")
        await b.close()
    if fails: sys.exit(1)
    print("\nall homepage boundary checks passed")
asyncio.run(main())
