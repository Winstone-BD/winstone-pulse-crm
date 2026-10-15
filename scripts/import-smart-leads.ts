/**
 * One-off HQ import of the "Winstone Smarter Leads" sheet into the LeadHub
 * pool. Every row goes through the canonical intake path (lead-intake.server)
 * with ownerId: null, so leads land unassigned and only LeadHub Nexus
 * distributes them. Duplicates are detected by the intake path itself.
 *
 * Usage: bun scripts/import-smart-leads.ts <offset> <limit>
 */
import { readFileSync, appendFileSync } from "node:fs";

type Row = {
  name: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  industry: string | null;
  grade: string | null;
  score: string | null;
  priority: string | null;
  source: string | null;
};

const rows: Row[] = JSON.parse(readFileSync("/tmp/smart-leads.json", "utf8"));
const offset = Number(process.argv[2] ?? 0);
const limit = Number(process.argv[3] ?? rows.length);
const slice = rows.slice(offset, offset + limit);

const { intakeLead } = await import("@/lib/lead-intake.server");

let added = 0;
let duplicate = 0;
const failed: string[] = [];
const started = Date.now();

for (const [i, row] of slice.entries()) {
  const notes = [
    row.industry ? `খাত: ${row.industry}` : null,
    row.grade ? `অগ্রাধিকার: ${row.grade}` : null,
    row.score ? `Smart Score: ${row.score}` : null,
    row.priority ? `Smart Priority: ${row.priority}` : null,
    row.source ? `সূত্র: ${row.source}` : null,
  ]
    .filter(Boolean)
    .join(" | ")
    .slice(0, 500);
  try {
    const result = await intakeLead({
      name: row.name!,
      phoneNumber: row.phone!,
      company: row.company,
      address: row.address,
      notes,
      ownerId: null,
      actorLabel: "HQ import — Winstone Smarter Leads",
    });
    if (result.duplicate) duplicate += 1;
    else added += 1;
  } catch (error) {
    failed.push(`${row.name}: ${(error as Error).message}`);
  }
  if ((i + 1) % 50 === 0) {
    console.log(
      `progress ${offset + i + 1}/${rows.length} added=${added} dup=${duplicate} failed=${failed.length} ${Math.round((Date.now() - started) / 1000)}s`,
    );
  }
}

appendFileSync(
  "/tmp/import-results.jsonl",
  JSON.stringify({ offset, limit, added, duplicate, failed }) + "\n",
);
console.log(`DONE offset=${offset} added=${added} duplicate=${duplicate} failed=${failed.length}`);
for (const f of failed.slice(0, 20)) console.log("FAIL:", f);
