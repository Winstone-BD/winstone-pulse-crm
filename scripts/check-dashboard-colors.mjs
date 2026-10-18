#!/usr/bin/env node
// Fails when a frontend UI file uses a hardcoded colour instead of a
// semantic design token from src/styles.css.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const TARGETS = ["src/routes", "src/components"];

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const RULES = [
  { name: "Tailwind palette colour", re: new RegExp(`\\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|shadow|decoration|accent|caret)-(?:${PALETTE})-\\d{2,3}\\b`, "g") },
  { name: "white/black utility", re: /\b(?:bg|text|border|ring|fill|stroke|from|via|to)-(?:white|black)\b/g },
  { name: "arbitrary colour value", re: /-\[(?:#|rgb|hsl|oklch)[^\]]*\]/g },
  { name: "hex colour literal", re: /["'`]#[0-9a-fA-F]{3,8}["'`]/g },
  { name: "rgb/hsl colour literal", re: /["'`](?:rgba?|hsla?)\(\s*\d/g },
];

function files(p) {
  if (!existsSync(p)) return [];
  if (statSync(p).isFile()) return /\.(tsx?|jsx?)$/.test(p) && !/\.test\./.test(p) ? [p] : [];
  return readdirSync(p).flatMap((f) => files(join(p, f)));
}

const problems = [];
for (const file of TARGETS.flatMap(files)) {
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (line.includes("color-check-ignore")) return;
    // Browser chrome metadata and Recharts selectors match external defaults;
    // neither assigns a component colour outside the token system.
    if (file === "src/routes/__root.tsx" && line.includes('name: "theme-color"')) return;
    if (file === "src/components/ui/chart.tsx" && line.includes("recharts-cartesian")) return;
    for (const { name, re } of RULES) {
      for (const m of line.matchAll(re)) problems.push(`${file}:${i + 1}  ${name}: ${m[0]}`);
    }
  });
}

if (problems.length) {
  console.error(`✗ Hardcoded colours in frontend UI (use semantic tokens):\n${problems.join("\n")}`);
  process.exit(1);
}
console.log("✓ Global frontend colour check OK — semantic tokens only");
