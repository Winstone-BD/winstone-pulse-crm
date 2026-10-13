// Alerts when a stable 4.x of @lovable.dev/mcp-js exists. Does NOT upgrade.
// Usage: node scripts/check-mcp-js-stable.mjs   (exit 2 = stable release available)
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const current = pkg.dependencies?.["@lovable.dev/mcp-js"] ?? pkg.devDependencies?.["@lovable.dev/mcp-js"];
const versions = JSON.parse(execSync("npm view @lovable.dev/mcp-js versions --json", { encoding: "utf8" }));
const stable4 = versions.filter((v) => /^4\.\d+\.\d+$/.test(v));
console.log(`current: ${current}`);
if (!stable4.length) { console.log("OK: no stable 4.x yet — stay on the release candidate."); process.exit(0); }
const latest = stable4.at(-1);
console.log(`ALERT: stable @lovable.dev/mcp-js ${latest} is available.`);
console.log("Before upgrading: bun add @lovable.dev/mcp-js@" + latest + " && bunx vitest run tests/mcp-tools.test.ts,");
console.log("regenerate the MCP manifest, confirm the same tools, keep vite-tanstack-config at 2.25.2, then build.");
process.exit(2);
