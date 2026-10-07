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

// Verify lockfiles resolve to exactly the pinned version.
// package-lock.json: packages["node_modules/<pkg>"].version
try {
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  const v = lock.packages?.[`node_modules/${PKG}`]?.version;
  if (v !== PINNED) {
    console.error(`FAIL: package-lock.json resolves ${PKG} to ${v ?? "(missing)"} — must be exactly ${PINNED}`);
    failed = true;
  } else {
    console.log(`OK: package-lock.json resolves ${PKG} to ${PINNED}`);
  }
} catch {
  console.log(`SKIP: no package-lock.json`);
}

// bun.lock (JSONC-ish): the resolved entry is ["<pkg>@<version>", ...]
try {
  const bunLock = readFileSync("bun.lock", "utf8");
  const m = bunLock.match(new RegExp(`"${PKG.replace(/[/.]/g, "\\$&)}":\\s*\\["${PKG.replace(/[/.]/g, "\\$&)}@([^"]+)"`));
  const v = m?.[1];
  if (v !== PINNED) {
    console.error(`FAIL: bun.lock resolves ${PKG} to ${v ?? "(missing)"} — must be exactly ${PINNED}`);
    failed = true;
  } else {
    console.log(`OK: bun.lock resolves ${PKG} to ${PINNED}`);
  }
} catch {
  console.log(`SKIP: no bun.lock`);
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
