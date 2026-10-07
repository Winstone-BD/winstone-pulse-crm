#!/usr/bin/env node
// CI guard: @lovable.dev/vite-tanstack-config must stay pinned to 2.25.2.
// 2.26.0 emits createRequire(import.meta.url), which crashes every page on the
// live Cloudflare Worker while the dev preview keeps working — so only this
// check (or a deploy) catches it.
import { readFileSync } from "node:fs";

const PINNED = "2.25.2";
const PKG = "@lovable.dev/vite-tanstack-config";

let failed = false;

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const declared = pkg.devDependencies?.[PKG] ?? pkg.dependencies?.[PKG];
if (declared !== PINNED) {
  console.error(`FAIL: package.json has ${PKG}@${declared ?? "(missing)"} — must be exactly ${PINNED}`);
  failed = true;
} else {
  console.log(`OK: package.json pins ${PKG}@${PINNED}`);
}

// Also verify the actually-installed version, if node_modules is present.
try {
  const installed = JSON.parse(readFileSync(`node_modules/${PKG}/package.json`, "utf8"));
  if (installed.version !== PINNED) {
    console.error(`FAIL: installed ${PKG} is ${installed.version} — run install after pinning ${PINNED}`);
    failed = true;
  } else {
    console.log(`OK: installed ${PKG} is ${PINNED}`);
  }
} catch {
  console.log(`SKIP: node_modules not present; only package.json was checked`);
}

if (failed) {
  console.error("\nFix: set the version back to 2.25.2 in package.json and reinstall.");
  process.exit(1);
}
